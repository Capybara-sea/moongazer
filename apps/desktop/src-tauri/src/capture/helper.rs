// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The capture mode (the "sync helper" in the UI): this same exe, started
//! elevated by the app with [`ARG`] and a pipe name. It captures game frames
//! and passes them up the pipe. It decodes nothing, reads no keys or capture
//! pack, opens no window and never reaches the app's own setup (logging,
//! Tauri, the database): `main` branches here first.
//!
//! It takes no paths and no free-form commands, only [`Command`]s; a closed
//! pipe stops it like [`Command::Bye`].

use std::fs::{File, OpenOptions};
use std::io::{self, Write};
use std::os::windows::fs::OpenOptionsExt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use anyhow::{Context, Result};
use tracing_subscriber::filter::{LevelFilter, Targets};
use tracing_subscriber::fmt::MakeWriter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use windows_sys::Win32::Storage::FileSystem::SECURITY_IDENTIFICATION;

use super::backend::{self, DUPLICATES_DROPPED, MERGED_DATAGRAMS_SEEN};
use super::ipc::{Command, PROTOCOL, Report};
use crate::win;

/// The command-line switch that starts the capture mode.
pub const ARG: &str = "--capture";
/// Every pipe name the app makes starts so; the capture mode opens no other.
pub const PIPE_PREFIX: &str = r"\\.\pipe\moongazer-capture-";
/// Exists while a capture mode runs. The installer looks for it
/// (installer-hooks.nsh): it cannot replace the exe under a running capture
/// mode, nor end that elevated process.
const RUNNING_MUTEX: &str = r"Local\io.github.capybara-sea.moongazer.capture";

/// How long a capture waits for a frame before looking at its stop flag.
const POLL: Duration = Duration::from_millis(250);

/// Exit codes the app tells apart.
pub const EXIT_ARGUMENTS: i32 = 2;
pub const EXIT_PIPE: i32 = 3;
pub const EXIT_FAILED: i32 = 4;

/// Runs the capture mode when the command line asks for it, returning its
/// exit code; `None` for a normal start.
pub fn run_if_asked() -> Option<i32> {
    let mut args = std::env::args_os().skip(1);
    if args.next()? != ARG {
        return None;
    }
    // Before anything loads a DLL by name (see the function).
    win::capture::load_dlls_from_system32();
    let name = args.next().and_then(|name| name.into_string().ok());
    let Some(name) = name.filter(|name| valid_pipe_name(name)) else {
        return Some(EXIT_ARGUMENTS);
    };
    Some(match run(&name) {
        Ok(()) => 0,
        Err(Failure::Pipe) => EXIT_PIPE,
        Err(Failure::Other(err)) => {
            tracing::error!(error = %format!("{err:#}"), "capture mode failed");
            EXIT_FAILED
        }
    })
}

/// The prefix, then only what the app puts in a name: digits, lowercase hex
/// and dashes.
fn valid_pipe_name(name: &str) -> bool {
    name.strip_prefix(PIPE_PREFIX).is_some_and(|rest| {
        !rest.is_empty()
            && rest.len() <= 64
            && rest
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte) || byte == b'-')
    })
}

enum Failure {
    /// The pipes could not be opened: nobody to tell anything to.
    Pipe,
    Other(anyhow::Error),
}

/// The pipe up to the app, shared by every thread that reports.
type Up = Arc<Mutex<File>>;

fn send(up: &Up, report: &Report) -> io::Result<()> {
    report.write(&mut *up.lock().unwrap_or_else(|e| e.into_inner()))
}

fn open_pipe(name: &str, write: bool) -> io::Result<File> {
    OpenOptions::new()
        .read(!write)
        .write(write)
        // The app's end may not act as this elevated process.
        .security_qos_flags(SECURITY_IDENTIFICATION)
        .open(name)
}

fn run(name: &str) -> Result<(), Failure> {
    let _running = win::capture::named_mutex(RUNNING_MUTEX);
    let up = open_pipe(&format!("{name}-up"), true).map_err(|_| Failure::Pipe)?;
    let mut down = open_pipe(&format!("{name}-down"), false).map_err(|_| Failure::Pipe)?;
    let up: Up = Arc::new(Mutex::new(up));
    log_to(&up);
    send(&up, &Report::Hello { protocol: PROTOCOL })
        .context("saying hello")
        .map_err(Failure::Other)?;
    tracing::info!("capture mode ready");

    let mut capture: Option<Capture> = None;
    let result = loop {
        let command = match Command::read(&mut down) {
            Ok(Some(command)) => command,
            Ok(None) => break Ok(()),
            Err(err) => break Err(anyhow::Error::from(err).context("reading a command")),
        };
        match command {
            Command::Start { compatible } => {
                if let Some(running) = capture.take() {
                    running.stop();
                }
                capture = Some(Capture::start(compatible, up.clone()));
            }
            Command::Bye => break Ok(()),
        }
    };
    // The backend's own cleanup (pktmon's ETW session above all) runs when
    // it drops on its thread, so the thread is always joined: exiting with a
    // capture running would leave a system-wide ETW session behind.
    if let Some(running) = capture {
        running.stop();
    }
    tracing::info!("capture mode exiting");
    result.map_err(Failure::Other)
}

/// One running capture: a thread that owns the backend.
struct Capture {
    stop: Arc<AtomicBool>,
    thread: JoinHandle<()>,
}

impl Capture {
    fn start(compatible: bool, up: Up) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let flag = stop.clone();
        let thread = std::thread::Builder::new()
            .name("moongazer-capture".to_owned())
            .spawn(move || capture(compatible, &flag, &up))
            .expect("a thread can be started");
        Self { stop, thread }
    }

    fn stop(self) {
        self.stop.store(true, Ordering::Relaxed);
        if self.thread.join().is_err() {
            tracing::error!("the capture thread panicked");
        }
    }
}

fn capture(compatible: bool, stop: &AtomicBool, up: &Up) {
    MERGED_DATAGRAMS_SEEN.store(false, Ordering::Relaxed);
    let mut backend = match backend::create_capture(compatible) {
        Ok(backend) => backend,
        Err(err) => {
            tracing::warn!(compatible, "capture did not start");
            let _ = send(up, &Report::Failed(err.to_string()));
            return;
        }
    };
    tracing::info!(compatible, "capture started");
    if send(up, &Report::Started).is_err() {
        return;
    }
    let mut frames: u64 = 0;
    let mut merged_told = false;
    while !stop.load(Ordering::Relaxed) {
        match backend.next_packet(POLL) {
            Ok(Some(frame)) => {
                frames += 1;
                if send(up, &Report::Frame(frame.data)).is_err() {
                    break;
                }
            }
            Ok(None) => {}
            Err(err) => {
                tracing::warn!("capture stopped on an error");
                let _ = send(up, &Report::Failed(err.to_string()));
                break;
            }
        }
        if !compatible && !merged_told && MERGED_DATAGRAMS_SEEN.load(Ordering::Relaxed) {
            merged_told = true;
            let _ = send(up, &Report::Merged);
        }
    }
    drop(backend);
    tracing::info!(
        frames,
        duplicates = DUPLICATES_DROPPED.load(Ordering::Relaxed),
        etw_losses = ?backend::etw_losses(),
        "capture stopped"
    );
}

/// Sends this process's log lines up the pipe, where the app writes them to
/// its own log. Same levels as the app's log (see `logging`), with the app's
/// time stamp instead of this one's.
fn log_to(up: &Up) {
    let levels = Targets::new()
        .with_default(LevelFilter::INFO)
        .with_target("teyvatme", LevelFilter::ERROR);
    let writer = PipeLog(up.clone());
    let _ = tracing_subscriber::registry()
        .with(levels)
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(writer)
                .with_ansi(false)
                .without_time(),
        )
        .try_init();
    std::panic::set_hook(Box::new(|info| {
        // The location is a path on the build machine; the message is enough.
        tracing::error!(
            message = info.payload_as_str().unwrap_or(""),
            "capture mode panicked"
        );
    }));
}

struct PipeLog(Up);

impl<'a> MakeWriter<'a> for PipeLog {
    type Writer = LogLine;

    fn make_writer(&'a self) -> Self::Writer {
        LogLine {
            up: self.0.clone(),
            line: Vec::new(),
        }
    }
}

/// One event's formatted line, sent when the formatter is done with it.
struct LogLine {
    up: Up,
    line: Vec<u8>,
}

impl Write for LogLine {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.line.extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl Drop for LogLine {
    fn drop(&mut self) {
        let line = String::from_utf8_lossy(&self.line);
        let line = line.trim_end();
        if !line.is_empty() {
            // A log line that cannot be sent has nowhere else to go.
            let _ = send(&self.up, &Report::Log(line.to_owned()));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_apps_own_pipe_names_are_opened() {
        assert!(valid_pipe_name(
            r"\\.\pipe\moongazer-capture-1234-00ff1a2b3c4d5e6f"
        ));
        assert!(!valid_pipe_name(r"\\.\pipe\moongazer-capture-"));
        assert!(!valid_pipe_name(r"\\.\pipe\other-1234"));
        assert!(!valid_pipe_name(r"\\.\pipe\moongazer-capture-..\x"));
        assert!(!valid_pipe_name(r"\\server\pipe\moongazer-capture-12"));
        assert!(!valid_pipe_name(r"\\.\pipe\moongazer-capture-12AB"));
    }
}
