// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The decoding thread. It owns the decoder (upstream's `PlayerData` may not
//! be shared between threads) and tells the supervisor what happened. A panic
//! in here stops decoding only: the panic hook in main.rs lets this thread
//! go, and the supervisor sees the thread gone.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender};
use std::time::{Duration, Instant};

use teyvatme_core::decode::KeyReport;
use teyvatme_core::delta::{self, Keyed};

use super::decoder::{Decoder, Exported};
use super::now_ms;
use super::settle::Settle;

pub const THREAD_NAME: &str = "moongazer-decoder";

/// How often an export goes out for a batch while data keeps coming: an
/// export is not cheap.
const CHANGES_EVERY: Duration = Duration::from_secs(15);

/// How long the thread sleeps when nothing is due.
const IDLE: Duration = Duration::from_secs(1);

pub enum Input {
    Frame(Vec<u8>, u64),
    /// When the game started, when this capture saw it start.
    GameStarted(Option<u64>),
    /// An export for a snapshot now, answered on `reply`; with
    /// `only_if_changed`, none when nothing upstream's diff covers changed
    /// since the last export handed out.
    Export {
        only_if_changed: bool,
        reply: Sender<Option<Exported>>,
    },
}

pub enum Output {
    /// The sniffer's key situation changed.
    Key(KeyReport),
    /// A login is under way (a new connection, or a handshake).
    Connection,
    /// A new login's data replaced the account held so far.
    NewLogin,
    ChineseClient(bool),
    /// The capture delivers only this PC's sends.
    OneWay,
    /// The login's data has settled: its first snapshot.
    Settled(Exported),
    /// The connection a settled login was read from ended: its export, kept
    /// (when something changed) before a new login (another account, maybe)
    /// replaces it.
    Ended(Exported),
    /// An export of a settled login while data keeps coming, at most every
    /// 15 s: the supervisor stores what changed since the one before.
    Batch(Exported),
    /// An export failed (serialising it, which should not happen).
    ExportFailed,
}

/// Shared with the supervisor: when commands under the session key last
/// arrived (unix ms), and how many frames the server sent since the
/// connection began.
#[derive(Default)]
pub struct Clocks {
    pub session_traffic: AtomicU64,
    pub received_since_reset: AtomicU64,
}

pub fn run(
    mut decoder: Decoder,
    input: &Receiver<Input>,
    clocks: &Arc<Clocks>,
    out: impl Fn(Output),
) {
    let mut settle = Settle::default();
    let mut key = decoder.key();
    // Whether this login has settled: batches come only after.
    let mut settled = false;
    // The last export a save took. Settled and Ended do not count: the
    // supervisor drops them when a stop was queued before them.
    let mut handed_out: Option<Keyed> = None;
    let mut changes_due: Option<Instant> = None;
    let mut changes_at: Option<Instant> = None;

    loop {
        let now = Instant::now();
        let wait = [
            settle.remaining(now, decoder.login_parts()),
            changes_due.map(|due| due.saturating_duration_since(now)),
        ]
        .into_iter()
        .flatten()
        .fold(IDLE, Duration::min);
        match input.recv_timeout(wait) {
            Ok(Input::Frame(frame, at_ms)) => {
                let fed = decoder.feed(frame, at_ms);
                if fed.new_login {
                    settle = Settle::default();
                    settled = false;
                    handed_out = None;
                    changes_due = None;
                    out(Output::NewLogin);
                }
                if fed.connection {
                    out(Output::Connection);
                }
                if fed.reset
                    && settled
                    && let Ok(Some(exported)) = decoder.export(now_ms())
                {
                    out(Output::Ended(exported));
                }
                if let Some(chinese) = fed.chinese_client {
                    out(Output::ChineseClient(chinese));
                }
                if fed.one_way {
                    out(Output::OneWay);
                }
                let report = decoder.key();
                if report != key {
                    key = report;
                    out(Output::Key(report));
                }
                if fed.session_traffic {
                    clocks.session_traffic.store(at_ms, Ordering::Relaxed);
                }
                clocks
                    .received_since_reset
                    .store(decoder.received_since_reset(), Ordering::Relaxed);
                if fed.data {
                    settle.on_data(Instant::now(), decoder.login_parts());
                }
                if fed.applied && settled && changes_due.is_none() {
                    let earliest = changes_at.map_or(now, |at| at + CHANGES_EVERY);
                    changes_due = Some(earliest.max(now));
                }
            }
            Ok(Input::GameStarted(started_ms)) => decoder.set_game_started(started_ms),
            Ok(Input::Export {
                only_if_changed,
                reply,
            }) => {
                let exported = decoder.export(now_ms()).unwrap_or_else(|_| {
                    out(Output::ExportFailed);
                    None
                });
                let unchanged = only_if_changed
                    && exported.as_ref().zip(handed_out.as_ref()).is_some_and(
                        |(exported, handed_out)| {
                            delta::diff(handed_out, &exported.keyed).is_empty()
                        },
                    );
                if unchanged {
                    let _ = reply.send(None);
                    continue;
                }
                // Only an export that reached the supervisor counts as handed
                // out: one it gave up waiting for was never stored.
                let keyed = exported.as_ref().map(|exported| exported.keyed.clone());
                if reply.send(exported).is_ok() && keyed.is_some() {
                    handed_out = keyed;
                }
            }
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => return,
        }

        let now = Instant::now();
        if settle.poll(now, decoder.login_parts()) {
            match decoder.export(now_ms()) {
                Ok(Some(exported)) => {
                    settled = true;
                    out(Output::Settled(exported));
                }
                // The account went (a new login replaced it) in between.
                Ok(None) => {}
                Err(_) => out(Output::ExportFailed),
            }
        }
        if changes_due.is_some_and(|due| due <= now) {
            changes_due = None;
            changes_at = Some(now);
            if settled && let Ok(Some(exported)) = decoder.export(now_ms()) {
                out(Output::Batch(exported));
            }
        }
    }
}
