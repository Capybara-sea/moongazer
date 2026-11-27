// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Auto sync's supervisor: one thread that starts and stops the capture
//! mode, runs the decoding thread, works out the status the page and the
//! tray show, and saves snapshots. Everything that happens reaches it as an
//! [`Event`]; it never blocks on the capture itself.
//!
//! Timings follow Teyvat.me Capture's monitor (v1.17.28): restarts back off
//! from 3 s to 30 s, a capture silent for 60 s while the game runs is
//! restarted once, and a login counts as read while session traffic came in
//! the last 10 s.

use std::panic::AssertUnwindSafe;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use account::Export;
use account::delta::{self, Change};
use serde::Serialize;
use serde_json::Value;
use storage::Session;
use tauri::{AppHandle, Emitter, Manager};
use teyvatme_core::decode::KeyReport;
use teyvatme_protocol::KeyState;

use super::carry::{self, Carry};
use super::decoder::{Account, Decoder, Exported};
use super::ipc::{Command, Report};
use super::link::{Link, LinkError};
use super::now_ms;
use super::pack::Pack;
use super::settings;
use super::worker::{self, Clocks, Input, Output};
use crate::snapshots;

/// The status, sent to the page whenever it changes.
pub const STATUS_EVENT: &str = "capture-status";
/// One more batch of changes since the login.
pub const CHANGE_EVENT: &str = "capture-change";
/// The batches since the login are gone (a new login, or sync stopped).
pub const CHANGES_CLEARED_EVENT: &str = "capture-changes-cleared";
/// A snapshot was saved, or the live point ended; the page reloads its
/// history.
pub const SAVED_EVENT: &str = "snapshots-changed";
/// A batch was stored while playing: its head row, the export now held.
pub const HEAD_EVENT: &str = "snapshot-head";

const GAME_PROCESSES: [&str; 2] = [CHINESE_CLIENT, "GenshinImpact.exe"];
const CHINESE_CLIENT: &str = "YuanShen.exe";

const TICK: Duration = Duration::from_secs(1);
const GAME_SCAN: Duration = Duration::from_secs(2);
const RETRY_BASE: Duration = Duration::from_secs(3);
const RETRY_MAX: Duration = Duration::from_secs(30);
const SILENCE_LIMIT: Duration = Duration::from_secs(60);
/// Session traffic this recent means the game is being read.
const READING_TTL: u64 = 10_000;
/// Game traffic for this long with no login seen: the player was in the
/// game before sync started.
const IN_WORLD_GRACE: Duration = Duration::from_secs(8);
/// The login exchange still on the dispatch key this long: the session key
/// was lost.
const KEY_RECOVERY_GRACE: Duration = Duration::from_secs(30);
/// A login seen this long ago and still no key at all: the capture pack has
/// no dispatch key for this game version.
const NO_KEY_GRACE: Duration = Duration::from_secs(15);
/// ...but only once the server sent this many frames within one burst window
/// (see `worker`): a login's data is a few MB in thousands of frames, while a
/// game idling at its title screen sends almost nothing. Counting all frames
/// since the connection read as "no key" at the title screen, first right
/// away (2026-11-18), then after a long idle (2026-11-21).
pub(super) const LOGIN_BURST_FRAMES: u64 = 300;
/// How long the capture mode gets to exit after a goodbye.
const EXIT_WAIT: Duration = Duration::from_secs(5);
/// How long an export for a snapshot may take (a key search can hold the
/// decoding thread for seconds).
const EXPORT_WAIT: Duration = Duration::from_secs(20);

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    #[default]
    Off,
    Starting,
    WaitingGame,
    WaitingLogin,
    Connected,
    Interrupted,
}

/// The capture mode's state, the first of the panel's steps.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Helper {
    #[default]
    Off,
    Starting,
    Running,
    /// The capture failed and is retried.
    Retrying,
    /// The capture mode exited without being asked.
    Exited,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Server {
    China,
    Global,
}

/// Something the user should know, at most one at a time.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Problem {
    /// The elevation prompt was answered no.
    Declined,
    /// The capture mode could not be started.
    LaunchFailed,
    /// The capture pack is missing or from another build.
    PackUnavailable,
    /// The capture mode exited without being asked.
    HelperExited,
    /// The decoding thread stopped on an error.
    DecoderStopped,
    /// The capture failed to start and is retried.
    CaptureFailed,
    /// The game was already past its login when sync started.
    AlreadyInGame,
    /// The login's session key could not be recovered: log in again.
    KeyLost,
    /// No key at all for the game's login: the pack is older than the game.
    PackOutdated,
    /// The export left out entities the game data does not know.
    DataOutdated { left_out: String },
    /// Moved to the compatible capture; this login is likely lost.
    SwitchedToCompatible,
    /// Sync was stopped for an update that then failed to install.
    UpdateFailed,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub phase: Phase,
    pub helper: Helper,
    /// The game client running, by its process name or its version.
    pub server: Option<Server>,
    /// The login's session key is held: the player is in Teyvat.
    pub entered: bool,
    pub account: Option<Account>,
    /// When this login's session key came (unix ms).
    pub login_at: Option<u64>,
    /// When reading stopped, for an interrupted sync (unix ms).
    pub lost_at: Option<u64>,
    /// The login's data has settled and was saved.
    pub settled: bool,
    pub saved_at: Option<u64>,
    pub compatible: bool,
    pub problem: Option<Problem>,
}

enum Event {
    Start,
    Stop,
    SaveNow,
    /// Stops sync before the app exits or updates; answers whether the
    /// capture mode exited.
    Shutdown(Sender<bool>),
    /// The update sync was stopped for did not install.
    UpdateFailed,
    // The rest come from a run's own threads and name the run, so a late
    // event from a run that ended never touches the next one.
    Report(u64, Report),
    LinkClosed(u64),
    Decoded(u64, Output),
    DecoderGone {
        run: u64,
        panicked: bool,
    },
}

/// What changed between two exports of a login, and when the later one was
/// read (its own timestamp, unix ms). At most one every 15 s, and only when
/// something changed.
#[derive(Clone, Debug, Serialize)]
pub struct Batch {
    pub at: i64,
    pub changes: Vec<Change>,
}

/// A settled login's record: where its batches go and what the next one is
/// counted from.
struct Chain {
    /// The login snapshot's id; `None` when it could not be saved: the panel
    /// still lists changes, but none are stored.
    session: Option<i64>,
    /// The export the next batch is counted from, and its timestamp.
    last: Value,
    last_at: i64,
    /// `last` holds changes no snapshot does.
    unsaved: bool,
    /// Storing a batch failed (logged once per session).
    failed: bool,
    /// The account's challenge records its exports lack until the game
    /// sends them again (see carry.rs).
    carry: Carry,
}

/// What became of a batch.
#[derive(PartialEq, Eq)]
enum Appended {
    Stored(i64),
    /// There is no session to store it in.
    Unstored,
    /// The session's login snapshot was deleted meanwhile.
    Gone,
    Failed,
}

/// The managed state the commands reach the supervisor through.
pub struct AutoSync {
    events: Sender<Event>,
    status: Arc<Mutex<Status>>,
    batches: Arc<Mutex<Vec<Batch>>>,
}

impl AutoSync {
    /// `owner` is the main window, which the elevation prompt belongs to.
    /// Taken on the main thread: the supervisor asking for it later could
    /// wait on a main thread that is waiting for the supervisor.
    pub fn spawn(app: &AppHandle, owner: Option<isize>) -> Self {
        let (events, rx) = mpsc::channel();
        let status = Arc::new(Mutex::new(Status::default()));
        let batches = Arc::new(Mutex::new(Vec::new()));
        let mut supervisor = Supervisor::new(
            app.clone(),
            owner,
            events.clone(),
            rx,
            status.clone(),
            batches.clone(),
        );
        std::thread::Builder::new()
            .name("moongazer-sync".to_owned())
            .spawn(move || supervisor.run())
            .expect("a thread can be started");
        Self {
            events,
            status,
            batches,
        }
    }

    pub fn status(&self) -> Status {
        self.status
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    /// Stops sync and waits for the capture mode to exit; true when it did
    /// (or was not running).
    pub fn shutdown(&self) -> bool {
        let (reply, answer) = mpsc::channel();
        if self.events.send(Event::Shutdown(reply)).is_err() {
            return true;
        }
        answer
            .recv_timeout(EXPORT_WAIT + EXIT_WAIT + Duration::from_secs(1))
            .unwrap_or(false)
    }

    /// Says the update sync was stopped for did not install, so the panel
    /// tells why sync is off. Sync is not started again by itself: that
    /// would raise the elevation prompt out of nowhere.
    pub fn update_failed(&self) {
        self.send(Event::UpdateFailed);
    }

    fn send(&self, event: Event) {
        let _ = self.events.send(event);
    }
}

#[tauri::command]
pub fn capture_status(sync: tauri::State<'_, AutoSync>) -> Status {
    sync.status()
}

/// Every batch of changes since the login, oldest first (for a page that
/// loads after they came).
#[tauri::command]
pub fn capture_changes(sync: tauri::State<'_, AutoSync>) -> Vec<Batch> {
    sync.batches
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
}

#[tauri::command]
pub fn capture_start(sync: tauri::State<'_, AutoSync>) {
    sync.send(Event::Start);
}

#[tauri::command]
pub fn capture_stop(sync: tauri::State<'_, AutoSync>) {
    sync.send(Event::Stop);
}

#[tauri::command]
pub fn capture_save_now(sync: tauri::State<'_, AutoSync>) {
    sync.send(Event::SaveNow);
}

/// The capture backend inside the capture mode.
enum Capture {
    Starting,
    Running,
    Failed { retry_at: Instant },
}

struct Game {
    chinese: bool,
}

/// What a running sync holds; gone when sync is off.
struct Run {
    id: u64,
    link: Link,
    decoder: Option<Sender<Input>>,
    clocks: Arc<Clocks>,
    last_frame: Arc<AtomicU64>,
    capture: Capture,
    failures: u32,
    /// Frames from before this time are not this game session's: set when
    /// the capture (re)starts and when the game closes.
    frames_from_ms: u64,
    /// The first frame of this game session, once one came.
    first_frame_ms: Option<u64>,
    silence_restarted: bool,
}

struct Supervisor {
    app: AppHandle,
    owner: Option<isize>,
    events: Sender<Event>,
    rx: Receiver<Event>,
    shared: Arc<Mutex<Status>>,
    batches: Arc<Mutex<Vec<Batch>>>,
    status: Status,
    run: Option<Run>,
    /// The id the next run gets.
    next_run: u64,
    starting: bool,
    interrupted: bool,
    /// The game's server when an interrupted sync ended, still shown.
    lost_server: Option<Server>,
    compatible: bool,
    game: Option<Game>,
    game_scanned: bool,
    next_scan: Instant,
    key: Option<KeyReport>,
    /// When the key situation last changed.
    key_since: Instant,
    /// When a login was last seen going by.
    connection_at: Option<Instant>,
    chinese_client: Option<bool>,
    chain: Option<Chain>,
}

impl Supervisor {
    fn new(
        app: AppHandle,
        owner: Option<isize>,
        events: Sender<Event>,
        rx: Receiver<Event>,
        shared: Arc<Mutex<Status>>,
        batches: Arc<Mutex<Vec<Batch>>>,
    ) -> Self {
        let status = shared.lock().unwrap_or_else(|e| e.into_inner()).clone();
        Self {
            compatible: settings::compatible_capture(&app),
            app,
            owner,
            events,
            rx,
            shared,
            batches,
            status,
            run: None,
            next_run: 0,
            starting: false,
            interrupted: false,
            lost_server: None,
            game: None,
            game_scanned: false,
            next_scan: Instant::now(),
            key: None,
            key_since: Instant::now(),
            connection_at: None,
            chinese_client: None,
            chain: None,
        }
    }

    fn run(&mut self) {
        if settings::auto_start(&self.app) {
            self.start();
        }
        loop {
            match self.rx.recv_timeout(TICK) {
                Ok(event) => self.handle(event),
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => return,
            }
            self.tick();
            self.publish();
        }
    }

    fn handle(&mut self, event: Event) {
        match event {
            Event::Start => self.start(),
            Event::Stop => {
                self.stop();
            }
            Event::SaveNow => self.save_now(),
            Event::Shutdown(reply) => {
                let exited = self.stop();
                let _ = reply.send(exited);
            }
            Event::UpdateFailed => {
                if self.run.is_none() {
                    self.status.problem = Some(Problem::UpdateFailed);
                }
            }
            Event::Report(run, report) if self.is_current(run) => self.on_report(report),
            Event::LinkClosed(run) if self.is_current(run) => self.on_link_closed(),
            Event::Decoded(run, output) if self.is_current(run) => self.on_decoded(output),
            Event::DecoderGone { run, panicked } if self.is_current(run) => {
                if panicked {
                    tracing::error!("decoding stopped on an error");
                    self.status.problem = Some(Problem::DecoderStopped);
                    self.end_run(true);
                }
            }
            Event::Report(..)
            | Event::LinkClosed(_)
            | Event::Decoded(..)
            | Event::DecoderGone { .. } => {}
        }
    }

    fn is_current(&self, run: u64) -> bool {
        self.run.as_ref().is_some_and(|current| current.id == run)
    }

    fn start(&mut self) {
        if self.run.is_some() {
            return;
        }
        self.interrupted = false;
        self.clear_login();
        self.status.problem = None;
        self.starting = true;
        self.publish();

        let pack = match Pack::built_in() {
            Ok(pack) => pack,
            Err(err) => {
                tracing::error!(error = %format!("{err:#}"), "the capture pack is unusable");
                self.starting = false;
                self.status.problem = Some(Problem::PackUnavailable);
                return;
            }
        };
        let id = self.next_run;
        self.next_run += 1;
        let clocks = Arc::new(Clocks::default());
        let decoder = self.spawn_decoder(id, Decoder::new(pack), clocks.clone());
        let last_frame = Arc::new(AtomicU64::new(0));
        let deliver = {
            let events = self.events.clone();
            let frames = decoder.clone();
            let last_frame = last_frame.clone();
            move |report: Option<Report>| match report {
                Some(Report::Frame(frame)) => {
                    let at_ms = now_ms();
                    last_frame.store(at_ms, Ordering::Relaxed);
                    // Gone only after decoding stopped, which the supervisor
                    // hears about on its own.
                    let _ = frames.send(Input::Frame(frame, at_ms));
                }
                Some(Report::Log(line)) => tracing::info!(line = %line, "capture mode"),
                Some(report) => {
                    let _ = events.send(Event::Report(id, report));
                }
                None => {
                    let _ = events.send(Event::LinkClosed(id));
                }
            }
        };
        let mut link = match Link::open(self.owner, deliver) {
            Ok(link) => link,
            Err(err) => {
                self.starting = false;
                self.status.problem = Some(match err {
                    LinkError::Declined => {
                        tracing::info!("the elevation prompt was declined");
                        Problem::Declined
                    }
                    LinkError::Failed(err) => {
                        tracing::error!(error = %format!("{err:#}"), "starting the capture mode failed");
                        Problem::LaunchFailed
                    }
                });
                return;
            }
        };
        self.starting = false;
        let started = link.send(&Command::Start {
            compatible: self.compatible,
        });
        self.run = Some(Run {
            id,
            link,
            decoder: Some(decoder),
            clocks,
            last_frame,
            capture: Capture::Starting,
            failures: 0,
            frames_from_ms: now_ms(),
            first_frame_ms: None,
            silence_restarted: false,
        });
        if started.is_err() {
            // The pipe broke already: the reader reports the closed link.
            tracing::warn!("the start command did not get through");
        }
        self.key = None;
        self.connection_at = None;
        self.game = None;
        self.game_scanned = false;
        self.next_scan = Instant::now();
    }

    fn spawn_decoder(&self, run: u64, decoder: Decoder, clocks: Arc<Clocks>) -> Sender<Input> {
        let (input, rx) = mpsc::channel();
        let events = self.events.clone();
        let spawned = std::thread::Builder::new()
            .name(worker::THREAD_NAME.to_owned())
            .spawn(move || {
                let out = |output| {
                    let _ = events.send(Event::Decoded(run, output));
                };
                let result = std::panic::catch_unwind(AssertUnwindSafe(|| {
                    worker::run(decoder, &rx, &clocks, out);
                }));
                let _ = events.send(Event::DecoderGone {
                    run,
                    panicked: result.is_err(),
                });
            });
        if spawned.is_err() {
            let _ = self.events.send(Event::DecoderGone {
                run,
                panicked: true,
            });
        }
        input
    }

    /// Stops sync on request: saves what changed since the last snapshot,
    /// then lets the capture mode go. True when it exited.
    fn stop(&mut self) -> bool {
        if self.run.is_none() {
            self.interrupted = false;
            self.status.problem = None;
            return true;
        }
        self.save(true);
        self.end_run(false)
    }

    /// Ends the running sync. `interrupted` when it was not asked for.
    fn end_run(&mut self, interrupted: bool) -> bool {
        let Some(run) = self.run.take() else {
            return true;
        };
        self.end_chain();
        if interrupted {
            self.interrupted = true;
            self.lost_server = self.server();
            self.status.lost_at =
                Some(run.clocks.session_traffic.load(Ordering::Relaxed)).filter(|&at| at != 0);
        } else {
            self.interrupted = false;
            self.status.problem = None;
            self.clear_login();
        }
        // Dropping the input ends the decoding thread.
        drop(run.decoder);
        let exited = run.link.close(EXIT_WAIT);
        if !exited {
            tracing::warn!("the capture mode did not exit in time");
        }
        self.key = None;
        self.game = None;
        exited
    }

    /// Forgets the login shown in the panel.
    fn clear_login(&mut self) {
        self.end_chain();
        self.status.account = None;
        self.status.login_at = None;
        self.status.lost_at = None;
        self.status.settled = false;
        self.batches
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
        let _ = self.app.emit(CHANGES_CLEARED_EVENT, ());
    }

    fn on_link_closed(&mut self) {
        let Some(run) = &self.run else {
            return;
        };
        let code = run.link.exit_code();
        tracing::warn!(exit_code = ?code, "the capture mode went away");
        self.save(true);
        self.status.problem = Some(Problem::HelperExited);
        self.end_run(true);
    }

    fn on_report(&mut self, report: Report) {
        let Some(run) = &mut self.run else {
            return;
        };
        match report {
            Report::Started => {
                run.capture = Capture::Running;
                run.failures = 0;
                run.frames_from_ms = now_ms();
                run.first_frame_ms = None;
                if self.status.problem == Some(Problem::CaptureFailed) {
                    self.status.problem = None;
                }
            }
            Report::Failed(reason) => {
                let wait = RETRY_BASE
                    .saturating_mul(1 << run.failures.min(4))
                    .min(RETRY_MAX);
                run.failures += 1;
                tracing::warn!(reason = %reason, retry_in = ?wait, "capture failed");
                run.capture = Capture::Failed {
                    retry_at: Instant::now() + wait,
                };
                self.status.problem = Some(Problem::CaptureFailed);
            }
            Report::Merged => {
                tracing::warn!("merged datagrams on the real-time stream");
                self.switch_to_compatible();
            }
            Report::Hello { .. } | Report::Frame(_) | Report::Log(_) => {}
        }
    }

    fn on_decoded(&mut self, output: Output) {
        match output {
            Output::Key(report) => {
                // The connection time counts from this login's session key.
                if report.state != KeyState::Session {
                    self.status.login_at = None;
                } else if self.status.login_at.is_none() {
                    self.status.login_at = Some(now_ms());
                }
                self.key = Some(report);
                self.key_since = Instant::now();
            }
            Output::Connection => self.connection_at = Some(Instant::now()),
            // Who logged in is known again once the new login settles; its
            // session key came already.
            Output::NewLogin => {
                let login_at = self.status.login_at;
                self.clear_login();
                self.status.login_at = login_at;
            }
            Output::ChineseClient(chinese) => self.chinese_client = Some(chinese),
            Output::OneWay => {
                tracing::warn!("the capture delivered only this PC's sends");
                self.switch_to_compatible();
            }
            Output::Settled(exported) => {
                self.status.settled = true;
                self.on_settled(exported);
            }
            Output::Ended(exported) => self.store(exported, true),
            Output::Batch(exported) => self.on_batch(exported),
            Output::ExportFailed => tracing::error!("an export failed"),
        }
    }

    /// Moves to the compatible capture for good. The login under way was
    /// likely lost with the frames that went missing.
    fn switch_to_compatible(&mut self) {
        if self.compatible {
            return;
        }
        self.compatible = true;
        settings::set_compatible_capture(&self.app, true);
        self.status.problem = Some(Problem::SwitchedToCompatible);
        if let Some(run) = &mut self.run {
            run.capture = Capture::Starting;
            let _ = run.link.send(&Command::Start { compatible: true });
        }
    }

    fn save_now(&mut self) {
        self.save(false);
    }

    /// Asks the decoding thread for an export and stores it; with
    /// `only_if_changed`, only when it differs from the last one stored.
    fn save(&mut self, only_if_changed: bool) {
        let Some(input) = self.run.as_ref().and_then(|run| run.decoder.as_ref()) else {
            return;
        };
        let (reply, answer) = mpsc::channel();
        // During a session store() tells by our own diff: upstream's, which
        // the decoding thread uses, leaves some sections out.
        let ask = Input::Export {
            only_if_changed: only_if_changed && self.chain.is_none(),
            reply,
        };
        if input.send(ask).is_err() {
            return;
        }
        match answer.recv_timeout(EXPORT_WAIT) {
            Ok(Some(exported)) => self.store(exported, only_if_changed),
            Ok(None) => {}
            Err(_) => tracing::warn!("no export came in time"),
        }
    }

    /// A settled login's first export: saved as its login snapshot, it starts
    /// the session the login's batches go to.
    fn on_settled(&mut self, mut exported: Exported) {
        self.end_chain();
        let mut carry = self.carry_for(exported.account.uid);
        exported.json = carry::fill_text(std::mem::take(&mut exported.json), &carry);
        let Some((export, json)) = self.take(exported) else {
            return;
        };
        carry.extend(carry::held(&export.value));
        let saved = self.save_snapshot(&export, &json, Some(Session::New));
        self.chain = Some(Chain {
            session: saved.as_ref().and_then(|saved| saved.session),
            last_at: taken_at(&export),
            last: export.value,
            unsaved: saved.is_none(),
            failed: false,
            carry,
        });
    }

    /// The account's last challenge records and shop, from its newest kept exports.
    /// Exports carry them on once they are found, so only the first few
    /// are read: an account that never had them costs no more.
    fn carry_for(&self, uid: Option<u32>) -> Carry {
        const LOOKBACK: usize = 10;
        let mut carry = Carry::new();
        let Some(uid) = uid else {
            return carry;
        };
        let storage = self.app.state::<snapshots::Storage>();
        for raw in storage.kept_exports(u64::from(uid)).take(LOOKBACK) {
            let Ok(export) = serde_json::from_slice::<Value>(&raw) else {
                continue;
            };
            if carry::gather(&mut carry, &export) {
                break;
            }
        }
        carry
    }

    /// An export while playing: what changed since the last one is stored as
    /// a batch, and the export is what the page shows.
    fn on_batch(&mut self, mut exported: Exported) {
        let Some(chain) = &mut self.chain else {
            return;
        };
        exported.json = carry::fill_text(std::mem::take(&mut exported.json), &chain.carry);
        let Some(export) = parse(&exported.json) else {
            return;
        };
        chain.carry.extend(carry::held(&export.value));
        let at = taken_at(&export);
        // Queued while a snapshot took a later export.
        if at <= chain.last_at {
            return;
        }
        let changes = delta::diff(&chain.last, &export.value);
        if changes.is_empty() {
            return;
        }
        let unsaved = match self.append(at, &export, &changes) {
            Appended::Stored(batch) => {
                let storage = self.app.state::<snapshots::Storage>();
                if let Some(head) = storage.set_live(batch, exported.json) {
                    let _ = self.app.emit(HEAD_EVENT, head);
                }
                true
            }
            Appended::Gone => {
                // This export starts a new session in its place.
                self.app.state::<snapshots::Storage>().clear_live();
                let saved = self.save_snapshot(&export, &exported.json, Some(Session::New));
                if let Some(chain) = &mut self.chain {
                    chain.session = saved.as_ref().and_then(|saved| saved.session);
                    chain.failed = false;
                }
                saved.is_none()
            }
            Appended::Unstored => true,
            // The next batch counts these changes again.
            Appended::Failed => return,
        };
        self.show(at, changes);
        if let Some(chain) = &mut self.chain {
            chain.last = export.value;
            chain.last_at = at;
            chain.unsaved = unsaved;
        }
    }

    /// Saves an export as a snapshot. One that looks wrong next to its
    /// account's last snapshot is saved marked for review.
    /// During a session, what changed since its last batch is stored first,
    /// as a batch at the snapshot's time, and the snapshot joins the session.
    /// With `only_if_changed`, nothing is saved when nothing changed since
    /// the last snapshot.
    fn store(&mut self, mut exported: Exported, only_if_changed: bool) {
        if let Some(chain) = &self.chain {
            exported.json = carry::fill_text(std::mem::take(&mut exported.json), &chain.carry);
        }
        let Some((export, json)) = self.take(exported) else {
            return;
        };
        if let Some(chain) = &mut self.chain {
            chain.carry.extend(carry::held(&export.value));
        }
        let at = taken_at(&export);
        let mut session = None;
        // The changes since the last batch, and whether storing them failed.
        let mut pending = None;
        if let Some(chain) = &self.chain {
            // One queued while a snapshot took a later export holds nothing new.
            if only_if_changed && at <= chain.last_at {
                return;
            }
            let changes = delta::diff(&chain.last, &export.value);
            if only_if_changed && changes.is_empty() && !chain.unsaved {
                return;
            }
            session = chain.session.map(Session::Of);
            if !changes.is_empty() {
                let failed = self.append(at, &export, &changes) == Appended::Failed;
                pending = Some((changes, failed));
            }
        }
        let saved = self.save_snapshot(&export, &json, session);
        if saved.is_none() && pending.as_ref().is_some_and(|(_, failed)| *failed) {
            // Stored nowhere: the next batch counts these changes again.
            return;
        }
        if let Some((changes, _)) = pending {
            self.show(at, changes);
        }
        if let Some(chain) = &mut self.chain {
            if let Some(saved) = &saved {
                // Its login snapshot deleted, the session ended: this started the next.
                if saved.session != chain.session {
                    chain.session = saved.session;
                    chain.failed = false;
                }
                chain.unsaved = false;
            }
            chain.last = export.value;
            chain.last_at = at;
        }
        // The snapshot holds what the live point did. Without one saved, the
        // page reads the history again to stop showing the head as live.
        let cleared = self.app.state::<snapshots::Storage>().clear_live();
        if cleared && !saved.is_some_and(|saved| saved.saved) {
            let _ = self.app.emit(SAVED_EVENT, ());
        }
    }

    /// A whole export's account and what it left out go to the panel. The
    /// export parsed, and its text.
    fn take(&mut self, exported: Exported) -> Option<(Export, String)> {
        if exported.account.uid.is_some() {
            self.status.account = Some(exported.account);
        }
        match exported.left_out {
            Some(left_out) => self.status.problem = Some(Problem::DataOutdated { left_out }),
            None => {
                if matches!(self.status.problem, Some(Problem::DataOutdated { .. })) {
                    self.status.problem = None;
                }
            }
        }
        Some((parse(&exported.json)?, exported.json))
    }

    /// Saves an export as a snapshot of `session`; `None` when that failed.
    fn save_snapshot(
        &mut self,
        export: &Export,
        json: &str,
        session: Option<Session>,
    ) -> Option<snapshots::Captured> {
        let storage = self.app.state::<snapshots::Storage>();
        let captured = snapshots::import_capture(&storage, export, json, session)?;
        if captured.saved {
            self.status.saved_at = Some(now_ms());
            let _ = self.app.emit(SAVED_EVENT, ());
        }
        Some(captured)
    }

    /// Stores a batch of the session's changes, which lead to `export`.
    fn append(&mut self, at: i64, export: &Export, changes: &[Change]) -> Appended {
        let Some(chain) = &mut self.chain else {
            return Appended::Unstored;
        };
        let Some(session) = chain.session else {
            return Appended::Unstored;
        };
        let storage = self.app.state::<snapshots::Storage>();
        match storage.append_batch(session, at, export, changes) {
            Ok(Some(batch)) => Appended::Stored(batch),
            Ok(None) => {
                tracing::warn!("the login snapshot was deleted; a new session starts");
                Appended::Gone
            }
            Err(err) => {
                if !chain.failed {
                    chain.failed = true;
                    tracing::error!(error = %err, "storing a batch failed");
                }
                Appended::Failed
            }
        }
    }

    /// Lists a batch in the panel.
    fn show(&mut self, at: i64, changes: Vec<Change>) {
        let batch = Batch { at, changes };
        let _ = self.app.emit(CHANGE_EVENT, &batch);
        self.batches
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .push(batch);
    }

    /// The login's record ends, and with it the live point.
    fn end_chain(&mut self) {
        self.chain = None;
        // The page still shows the head row as live.
        if self.app.state::<snapshots::Storage>().clear_live() {
            let _ = self.app.emit(SAVED_EVENT, ());
        }
    }

    fn tick(&mut self) {
        let now = Instant::now();
        if self.run.is_some() && now >= self.next_scan {
            self.next_scan = now + GAME_SCAN;
            self.scan_game();
        }
        let game_running = self.game.is_some();
        let Some(run) = &mut self.run else {
            return;
        };
        match run.capture {
            Capture::Failed { retry_at } if now >= retry_at => {
                run.capture = Capture::Starting;
                let _ = run.link.send(&Command::Start {
                    compatible: self.compatible,
                });
            }
            Capture::Running => {
                let last_frame = run.last_frame.load(Ordering::Relaxed);
                let fresh = last_frame >= run.frames_from_ms;
                if fresh && run.first_frame_ms.is_none() {
                    run.first_frame_ms = Some(last_frame);
                }
                if run.silence_restarted && fresh {
                    run.silence_restarted = false;
                }
                // Only once this game session sent frames: none come while
                // the game is closed.
                let silent = run.first_frame_ms.is_some()
                    && now_ms().saturating_sub(last_frame.max(run.frames_from_ms))
                        > SILENCE_LIMIT.as_millis() as u64;
                if game_running && silent && !run.silence_restarted {
                    tracing::warn!(
                        "no frames for a minute while the game runs; restarting capture"
                    );
                    run.silence_restarted = true;
                    run.capture = Capture::Starting;
                    let _ = run.link.send(&Command::Start {
                        compatible: self.compatible,
                    });
                }
            }
            Capture::Failed { .. } | Capture::Starting => {}
        }
    }

    fn scan_game(&mut self) {
        let found = crate::win::capture::find_process(&GAME_PROCESSES);
        match (&self.game, found) {
            (None, Some(name)) => {
                // Only a start this sync saw is a start time: one later than
                // the real start would hide the first login from the search.
                let started_ms = self.game_scanned.then(now_ms);
                self.game = Some(Game {
                    chinese: name == CHINESE_CLIENT,
                });
                if let Some(input) = self.run.as_ref().and_then(|run| run.decoder.as_ref()) {
                    let _ = input.send(Input::GameStarted(started_ms));
                }
            }
            (Some(_), None) => {
                // The game closed: keep what changed in this session.
                self.save(true);
                self.game = None;
                self.key = None;
                self.connection_at = None;
                self.chinese_client = None;
                self.status.login_at = None;
                if let Some(run) = &mut self.run {
                    run.frames_from_ms = now_ms();
                    run.first_frame_ms = None;
                }
            }
            _ => {}
        }
        self.game_scanned = true;
    }

    /// Works the status out and sends it on when it changed.
    fn publish(&mut self) {
        let status = self.derive();
        let before = self.status_shared();
        if status == before {
            return;
        }
        // The account stays out of the log: only what the panel's state is.
        if (status.phase, status.helper, &status.problem)
            != (before.phase, before.helper, &before.problem)
        {
            tracing::info!(
                phase = ?status.phase,
                helper = ?status.helper,
                problem = ?status.problem,
                entered = status.entered,
                "sync status"
            );
        }
        *self.shared.lock().unwrap_or_else(|e| e.into_inner()) = status.clone();
        crate::background::sync_status(&self.app, &status);
        let _ = self.app.emit(STATUS_EVENT, status);
    }

    /// The running game's server, by its version once it said, else by its
    /// process name.
    fn server(&self) -> Option<Server> {
        self.game
            .as_ref()
            .map(|game| match self.chinese_client.unwrap_or(game.chinese) {
                true => Server::China,
                false => Server::Global,
            })
    }

    fn status_shared(&self) -> Status {
        self.shared
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    fn derive(&mut self) -> Status {
        let now = Instant::now();
        let mut status = self.status.clone();
        status.compatible = self.compatible;
        status.server = self.server();
        let key = self.key.unwrap_or(KeyReport {
            state: KeyState::None,
            recovery_failed: false,
            login_uid: None,
        });
        status.entered = key.state == KeyState::Session && self.game.is_some();

        let Some(run) = &self.run else {
            status.helper = if self.interrupted && status.problem == Some(Problem::HelperExited) {
                Helper::Exited
            } else {
                Helper::Off
            };
            status.phase = if self.starting {
                Phase::Starting
            } else if self.interrupted {
                Phase::Interrupted
            } else {
                Phase::Off
            };
            status.entered = false;
            status.server = if self.interrupted {
                self.lost_server
            } else {
                None
            };
            return status;
        };
        status.helper = match run.capture {
            Capture::Starting => Helper::Starting,
            Capture::Running => Helper::Running,
            Capture::Failed { .. } => Helper::Retrying,
        };
        let session_traffic = run.clocks.session_traffic.load(Ordering::Relaxed);
        let reading = now_ms().saturating_sub(session_traffic) <= READING_TTL;
        // Back at the title screen the session key is still held, but nothing
        // comes under it: the player is not in Teyvat (seen in the real test).
        status.entered &= reading;
        let silent_again = run.silence_restarted
            && now_ms().saturating_sub(run.last_frame.load(Ordering::Relaxed))
                > 2 * SILENCE_LIMIT.as_millis() as u64;

        // What keeps a game from being read, worked out from the timings.
        if self.game.is_some() && key.state != KeyState::Session {
            let seen_login = self.connection_at.is_some();
            let in_game_already = !seen_login
                && run.first_frame_ms.is_some_and(|first| {
                    now_ms().saturating_sub(first) >= IN_WORLD_GRACE.as_millis() as u64
                });
            let key_lost = key.recovery_failed
                || (key.state == KeyState::Dispatch
                    && now.saturating_duration_since(self.key_since) >= KEY_RECOVERY_GRACE);
            let no_key = key.state == KeyState::None
                && self
                    .connection_at
                    .is_some_and(|at| now.saturating_duration_since(at) >= NO_KEY_GRACE)
                && run.clocks.busiest_window.load(Ordering::Relaxed) >= LOGIN_BURST_FRAMES;
            let found = if key_lost {
                Some(Problem::KeyLost)
            } else if no_key {
                Some(Problem::PackOutdated)
            } else if in_game_already {
                Some(Problem::AlreadyInGame)
            } else {
                None
            };
            if found.is_some() && !matches!(status.problem, Some(Problem::SwitchedToCompatible)) {
                status.problem = found;
            }
        } else if matches!(
            status.problem,
            Some(
                Problem::KeyLost
                    | Problem::PackOutdated
                    | Problem::AlreadyInGame
                    | Problem::SwitchedToCompatible
            )
        ) {
            status.problem = None;
        }
        self.status.problem.clone_from(&status.problem);

        // Still retrying after a failure counts as lost too, or the phase
        // would flip back each time a retry starts.
        let lost = status.login_at.is_some()
            && ((run.failures > 0 && !matches!(run.capture, Capture::Running)) || silent_again);
        status.phase = if lost {
            status.lost_at = Some(session_traffic).filter(|&at| at != 0);
            Phase::Interrupted
        } else if self.game.is_none() {
            Phase::WaitingGame
        } else if status.entered && reading {
            Phase::Connected
        } else {
            Phase::WaitingLogin
        };
        if status.phase != Phase::Interrupted {
            status.lost_at = None;
        }
        status
    }
}

/// Parses one of auto sync's own exports, which always parse. Should one
/// not, the reason is not logged: it can quote a value.
fn parse(json: &str) -> Option<Export> {
    let export = account::parse(json.as_bytes()).ok();
    if export.is_none() {
        tracing::error!("the export did not parse");
    }
    export
}

/// When an export was read: its own timestamp, which auto sync's all have.
fn taken_at(export: &Export) -> i64 {
    export
        .taken_at()
        .unwrap_or_else(|| i64::try_from(now_ms()).unwrap_or(i64::MAX))
}
