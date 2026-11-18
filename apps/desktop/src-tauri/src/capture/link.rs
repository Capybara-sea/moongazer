// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The app's end of the capture mode: starting it elevated, its two pipes,
//! and the thread that reads what it reports.

use std::fs::File;
use std::hash::{BuildHasher, RandomState};
use std::io;
use std::os::windows::io::OwnedHandle;
use std::sync::Arc;
use std::sync::mpsc;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use anyhow::{Context, anyhow};

use super::helper::{ARG, PIPE_PREFIX};
use super::ipc::{Command, PROTOCOL, Report};
use crate::win::capture::{self as sys, ElevateError, Elevated, PipeEnd};

/// From the end of the elevation prompt to the capture mode's hello. It only
/// opens two pipes in between.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

pub enum LinkError {
    /// The user said no to the elevation prompt.
    Declined,
    Failed(anyhow::Error),
}

impl From<anyhow::Error> for LinkError {
    fn from(err: anyhow::Error) -> Self {
        Self::Failed(err)
    }
}

/// A running capture mode.
pub struct Link {
    process: Elevated,
    down: File,
    reader: Option<JoinHandle<()>>,
}

impl Link {
    /// Starts the capture mode and connects to it. Blocks while the user
    /// answers the elevation prompt (owned by the window `owner`). Every
    /// report then goes to `deliver` on a reader thread, and `None` once the
    /// pipe closed.
    pub fn open(
        owner: Option<isize>,
        deliver: impl FnMut(Option<Report>) + Send + 'static,
    ) -> Result<Self, LinkError> {
        let exe = std::env::current_exe().context("finding this exe")?;
        // The PID keeps two apps apart; the random part keeps another
        // program from making the pipe first under a name it guessed.
        let name = format!(
            "{PIPE_PREFIX}{}-{:016x}",
            std::process::id(),
            RandomState::new().hash_one(Instant::now())
        );
        let up = sys::create_pipe(&format!("{name}-up"), PipeEnd::Inbound)
            .context("creating the pipe from the capture mode")?;
        let down = sys::create_pipe(&format!("{name}-down"), PipeEnd::Outbound)
            .context("creating the pipe to the capture mode")?;

        let process =
            sys::run_elevated(&exe, &format!("{ARG} {name}"), owner).map_err(|err| match err {
                ElevateError::Declined => LinkError::Declined,
                ElevateError::Failed(err) => {
                    LinkError::Failed(anyhow!(err).context("starting the capture mode"))
                }
            })?;
        let (up, down) = connect(&process, up, down)?;
        tracing::info!("capture mode connected");
        let reader = std::thread::Builder::new()
            .name("moongazer-capture-pipe".to_owned())
            .spawn(move || read_reports(up, deliver))
            .context("starting the pipe reader")?;
        Ok(Self {
            process,
            down,
            reader: Some(reader),
        })
    }

    pub fn send(&mut self, command: &Command) -> io::Result<()> {
        command.write(&mut self.down)
    }

    /// The capture mode's exit code once it has exited.
    pub fn exit_code(&self) -> Option<u32> {
        sys::exit_code(&self.process.process, Duration::ZERO)
    }

    /// Says goodbye and waits up to `wait` for the capture mode to exit;
    /// true when it did. Closing the pipe tells it the same if the goodbye
    /// does not get through.
    pub fn close(mut self, wait: Duration) -> bool {
        let _ = self.send(&Command::Bye);
        let exited = sys::exit_code(&self.process.process, wait).is_some();
        drop(self.down);
        if exited && let Some(reader) = self.reader.take() {
            // The pipe closed with the process, so the reader is done.
            let _ = reader.join();
        }
        exited
    }
}

/// Waits until the capture mode has opened both pipes and said hello, and
/// checks that the process on the other end is the one just started.
fn connect(
    process: &Elevated,
    up: OwnedHandle,
    down: OwnedHandle,
) -> Result<(File, File), LinkError> {
    let up = Arc::new(up);
    let down = Arc::new(down);
    let (done, result) = mpsc::channel();
    let waiting = {
        let (up, down) = (up.clone(), down.clone());
        std::thread::Builder::new()
            .name("moongazer-capture-connect".to_owned())
            .spawn(move || {
                let _ = done.send(sys::connect_pipe(&up).and_then(|()| sys::connect_pipe(&down)));
            })
            .context("starting the pipe connection")?
    };

    let deadline = Instant::now() + CONNECT_TIMEOUT;
    let outcome = loop {
        match result.recv_timeout(Duration::from_millis(100)) {
            Ok(outcome) => break Some(outcome),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break None,
        }
        if Instant::now() >= deadline || sys::exit_code(&process.process, Duration::ZERO).is_some()
        {
            // A cancel that lands just before the wait begins cancels
            // nothing, so it is sent again until the waiting thread is done.
            loop {
                sys::cancel_io(&up);
                sys::cancel_io(&down);
                match result.recv_timeout(Duration::from_millis(100)) {
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                    Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
            break None;
        }
    };
    let _ = waiting.join();
    let exited = sys::exit_code(&process.process, Duration::ZERO);
    match outcome {
        Some(Ok(())) => {}
        Some(Err(err)) => {
            return Err(anyhow!(err)
                .context(format!(
                    "connecting to the capture mode (exit code {exited:?})"
                ))
                .into());
        }
        None => {
            return Err(
                anyhow!("the capture mode did not connect in time (exit code {exited:?})").into(),
            );
        }
    }
    for pipe in [&up, &down] {
        let client = sys::pipe_client_pid(pipe).context("asking who opened the pipe")?;
        if client != process.pid {
            return Err(anyhow!("a process other than the capture mode opened its pipe").into());
        }
    }
    let up = Arc::into_inner(up).context("the pipe is still shared")?;
    let down = Arc::into_inner(down).context("the pipe is still shared")?;
    Ok((File::from(up), File::from(down)))
}

/// Delivers every report, the first of which must be a hello in this build's
/// protocol, then `None`.
fn read_reports(up: File, mut deliver: impl FnMut(Option<Report>)) {
    let mut up = io::BufReader::with_capacity(256 * 1024, up);
    match Report::read(&mut up) {
        Ok(Some(Report::Hello { protocol })) if protocol == PROTOCOL => {}
        Ok(Some(Report::Hello { protocol })) => {
            tracing::warn!(
                protocol,
                expected = PROTOCOL,
                "the capture mode is from another build"
            );
            deliver(None);
            return;
        }
        _ => {
            tracing::warn!("the capture mode did not say hello");
            deliver(None);
            return;
        }
    }
    loop {
        match Report::read(&mut up) {
            Ok(Some(report)) => deliver(Some(report)),
            Ok(None) => break,
            Err(err) => {
                tracing::warn!(error = %err, "reading from the capture mode failed");
                break;
            }
        }
    }
    deliver(None);
}
