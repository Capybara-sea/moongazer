// SPDX-License-Identifier: MIT
// Copyright (c) 2026 tawan475
// Portions copyright (c) 2025 Erik Gilling and irminsul contributors
// See THIRD_PARTY_NOTICES.md.
// Changes copyright (c) 2026 Capybara_sea
// Modified from apps/desktop/src/monitor.rs (`automation_wait`, `rearmed` and
// their test) of https://github.com/tawan475/teyvat.me-capture at v1.17.28.

//! When a login's data has settled. A login's burst arrives over several
//! seconds, so a snapshot taken on the first packet would hold a half-read
//! account.

use std::time::{Duration, Instant};

use teyvatme_core::player_data::{LOGIN_COMPLETE_QUIET_MS, LoginParts};

/// How long the countdown waits after the last new data.
const QUIET: Duration = Duration::from_secs(5);

/// How long a countdown waits, from its start, for the world's exploration
/// points: 7.1 sends them 4-8 s after the bag.
const EXPLORE_WAIT: Duration = Duration::from_secs(12);

/// New data restarts a countdown only this long after it began, so a stream
/// of changes cannot hold the snapshot back.
const MAX_REARM: Duration = Duration::from_secs(20);

/// Once every part of the login is held, the countdown waits only this long
/// after the last new data, in place of the quiet and the exploration wait.
const COMPLETE_QUIET: Duration = Duration::from_millis(LOGIN_COMPLETE_QUIET_MS);

/// One login's countdown. Done stays done until a new login.
#[derive(Debug, Default)]
pub struct Settle {
    pending_since: Option<Instant>,
    armed_at: Option<Instant>,
    done: bool,
}

impl Settle {
    /// New data arrived at `now`: starts the countdown once the login's bag
    /// and characters are in, or restarts it.
    pub fn on_data(&mut self, now: Instant, login: LoginParts) {
        if self.done || !login.items || !login.characters {
            return;
        }
        match (self.pending_since, self.armed_at) {
            (Some(pending), Some(armed)) => {
                self.pending_since = Some(rearmed(pending, armed, now));
            }
            _ => {
                self.pending_since = Some(now);
                self.armed_at = Some(now);
            }
        }
    }

    /// How long the countdown still waits; `None` when none is running.
    pub fn remaining(&self, now: Instant, login: LoginParts) -> Option<Duration> {
        Some(wait(self.pending_since?, self.armed_at?, login, now))
    }

    /// True once, when the countdown runs out.
    pub fn poll(&mut self, now: Instant, login: LoginParts) -> bool {
        if self.remaining(now, login) != Some(Duration::ZERO) {
            return false;
        }
        self.pending_since = None;
        self.done = true;
        true
    }

    #[cfg(test)]
    fn done(&self) -> bool {
        self.done
    }
}

fn wait(pending_since: Instant, armed_at: Instant, login: LoginParts, now: Instant) -> Duration {
    let since_data = now.saturating_duration_since(pending_since);
    if login.complete() {
        return COMPLETE_QUIET.saturating_sub(since_data);
    }
    let quiet = QUIET.saturating_sub(since_data);
    if login.exploration {
        return quiet;
    }
    quiet.max(EXPLORE_WAIT.saturating_sub(now.saturating_duration_since(armed_at)))
}

fn rearmed(pending_since: Instant, armed_at: Instant, now: Instant) -> Instant {
    if now.saturating_duration_since(armed_at) < MAX_REARM {
        now
    } else {
        pending_since
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_countdown_waits_for_the_burst_and_the_exploration() {
        let start = Instant::now();
        let at = |s: u64| start + Duration::from_secs(s);
        let explored = LoginParts {
            exploration: true,
            ..LoginParts::default()
        };
        let nothing = LoginParts::default();
        // Exploration held: 5 s after the last data.
        assert_eq!(wait(start, start, explored, at(2)), Duration::from_secs(3));
        assert_eq!(wait(start, start, explored, at(6)), Duration::ZERO);
        // Not yet: until 12 s from the start, whichever ends later.
        assert_eq!(wait(start, start, nothing, at(6)), Duration::from_secs(6));
        assert_eq!(wait(at(10), start, nothing, at(11)), Duration::from_secs(4));
        assert_eq!(wait(start, start, nothing, at(13)), Duration::ZERO);
        // Every part of the login held: 3 s after the last data, whatever
        // the age of the countdown.
        let complete = LoginParts {
            items: true,
            characters: true,
            achievements: true,
            world: true,
            commissions: true,
            anecdotes: true,
            exploration: true,
        };
        assert!(complete.complete());
        assert_eq!(wait(start, start, complete, at(1)), Duration::from_secs(2));
        assert_eq!(wait(start, start, complete, at(3)), Duration::ZERO);
        assert_eq!(wait(at(7), start, complete, at(8)), Duration::from_secs(2));
        // One part short (a new account without the Travel Accounts book):
        // the old waits.
        let short = LoginParts {
            anecdotes: false,
            ..complete
        };
        assert_eq!(short.missing(), vec!["anecdotes"]);
        assert_eq!(wait(start, start, short, at(3)), Duration::from_secs(2));
        // New data restarts it, for 20 s at most.
        assert_eq!(rearmed(start, start, at(7)), at(7));
        assert_eq!(rearmed(at(19), start, at(21)), at(19));
    }

    #[test]
    fn a_login_settles_once_after_its_bag_and_characters() {
        let start = Instant::now();
        let at = |s: u64| start + Duration::from_secs(s);
        let mut settle = Settle::default();
        let bag_only = LoginParts {
            items: true,
            ..LoginParts::default()
        };
        settle.on_data(start, bag_only);
        assert_eq!(settle.remaining(start, bag_only), None);

        let complete = LoginParts {
            items: true,
            characters: true,
            achievements: true,
            world: true,
            commissions: true,
            anecdotes: true,
            exploration: true,
        };
        settle.on_data(at(1), complete);
        assert!(!settle.poll(at(2), complete));
        assert!(settle.poll(at(4), complete));
        assert!(settle.done());
        // Later data does not start another countdown.
        settle.on_data(at(30), complete);
        assert!(!settle.poll(at(40), complete));
    }
}
