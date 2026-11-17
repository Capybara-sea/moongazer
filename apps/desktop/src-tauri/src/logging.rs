// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! File logging in the app log directory, rotated daily.
//!
//! Nothing above info reaches the log: the workspace compiles tracing and log
//! with a static info cap, this subscriber filters at info as well, and no
//! code reads `RUST_LOG`.

use std::path::Path;

use anyhow::{Context, Result, anyhow};
use tracing::Subscriber;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{Builder, Rotation};
use tracing_subscriber::filter::{LevelFilter, Targets};
use tracing_subscriber::fmt::MakeWriter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

const KEEP_FILES: usize = 7;

/// Keep the returned guard alive for the life of the app; dropping it stops
/// the background writer.
pub fn init(dir: &Path) -> Result<WorkerGuard> {
    std::fs::create_dir_all(dir).context("creating the log directory")?;
    let appender = Builder::new()
        .rotation(Rotation::DAILY)
        .filename_prefix("moongazer")
        .filename_suffix("log")
        .max_log_files(KEEP_FILES)
        .build(dir)
        .context("opening the log file")?;
    let (writer, guard) = tracing_appender::non_blocking(appender);
    subscriber(writer)
        .try_init()
        .map_err(|err| anyhow!(err))
        .context("installing the logger")?;
    Ok(guard)
}

/// What the app logs, written to `writer`: info and above, but only errors
/// from Teyvat.me Capture's crates (every target starting with `teyvatme`).
/// At info and warn those write out the UID and other account data.
pub fn subscriber<W>(writer: W) -> impl Subscriber + Send + Sync
where
    W: for<'writer> MakeWriter<'writer> + Send + Sync + 'static,
{
    let levels = Targets::new()
        .with_default(LevelFilter::INFO)
        .with_target("teyvatme", LevelFilter::ERROR);
    tracing_subscriber::registry().with(levels).with(
        tracing_subscriber::fmt::layer()
            .with_writer(writer)
            .with_ansi(false),
    )
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use tracing_subscriber::fmt::MakeWriter;

    #[test]
    fn nothing_above_info_is_compiled_in() {
        use tracing::level_filters::{LevelFilter, STATIC_MAX_LEVEL};
        assert!(STATIC_MAX_LEVEL <= LevelFilter::INFO);
        assert!(log::STATIC_MAX_LEVEL <= log::LevelFilter::Info);
    }

    #[test]
    fn the_capture_crates_log_only_errors() {
        static LOG: Mutex<Vec<u8>> = Mutex::new(Vec::new());
        tracing::subscriber::with_default(super::subscriber(|| LOG.make_writer()), || {
            tracing::info!(target: "teyvatme_core::player_data", "upstream info");
            tracing::warn!(target: "teyvatme_protocol", "upstream warning");
            tracing::error!(target: "teyvatme_protocol::crypto", "upstream error");
            tracing::info!("our info");
        });
        let text = String::from_utf8_lossy(&LOG.lock().unwrap()).into_owned();
        assert!(!text.contains("upstream info"));
        assert!(!text.contains("upstream warning"));
        assert!(text.contains("upstream error"));
        assert!(text.contains("our info"));
    }
}
