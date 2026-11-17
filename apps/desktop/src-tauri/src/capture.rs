// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Turning captured game traffic into an account export, with Teyvat.me
//! Capture's crates. Everything here is behind the `capture` feature.
//!
//! The linked crates log account data, the UID included, at info and warn:
//! `logging` keeps everything of theirs below error out of the log.

mod decoder;
mod pack;
#[cfg(test)]
mod replay;
