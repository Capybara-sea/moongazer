// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Auto sync: capturing game traffic and turning it into account snapshots,
//! with Teyvat.me Capture's crates. Everything here is behind the `capture`
//! feature.
//!
//! Two processes of this same exe take part. The capture mode (`helper`),
//! started elevated, only captures frames and passes them on; the app
//! decodes them (`decoder`, on its own thread in `worker`) and decides what
//! to do (`service`).
//!
//! The linked crates log account data, the UID included, at info and warn:
//! `logging` keeps everything of theirs below error out of the log.

use std::time::{SystemTime, UNIX_EPOCH};

mod anecdotes;
#[expect(
    unsafe_code,
    reason = "the raw socket capture calls WinSock and IP Helper"
)]
mod backend;
mod carry;
mod commissions;
mod decoder;
mod events;
mod furnishings;
pub mod helper;
mod ipc;
mod link;
mod pack;
#[cfg(test)]
mod replay;
pub mod service;
pub mod settings;
mod settle;
mod worker;

pub use worker::THREAD_NAME as DECODER_THREAD;

/// Unix milliseconds.
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX)
        })
}
