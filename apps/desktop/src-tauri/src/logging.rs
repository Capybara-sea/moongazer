// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! File logging in the app log directory, rotated daily.
//!
//! Nothing above info reaches the log: the workspace compiles tracing and log
//! with a static info cap, this subscriber filters at info as well, and no
//! code reads `RUST_LOG`.

use std::path::Path;

use anyhow::{Context, Result, anyhow};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{Builder, Rotation};
use tracing_subscriber::filter::LevelFilter;

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
    tracing_subscriber::fmt()
        .with_writer(writer)
        .with_ansi(false)
        .with_max_level(LevelFilter::INFO)
        .try_init()
        .map_err(|err| anyhow!(err))
        .context("installing the logger")?;
    Ok(guard)
}

#[cfg(test)]
mod tests {
    #[test]
    fn nothing_above_info_is_compiled_in() {
        use tracing::level_filters::{LevelFilter, STATIC_MAX_LEVEL};
        assert!(STATIC_MAX_LEVEL <= LevelFilter::INFO);
        assert!(log::STATIC_MAX_LEVEL <= log::LevelFilter::Info);
    }
}
