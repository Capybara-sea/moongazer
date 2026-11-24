// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The events running. The game sends the whole list once a login, and later
//! one event at a time as it moves on (in 7.2 command 3191: the weekly training event once
//! resin is spent, a trial character after its trial). Upstream reads such an
//! update as the whole list and drops every other event till the next login,
//! so each list is merged into the login's list held here before it is
//! applied. An event that ends stays in the list; the pages leave it out by
//! its end.

use std::collections::BTreeMap;

use teyvatme_protocol::{CommandMatch, EventInfo};

#[derive(Default)]
pub struct Events {
    held: Option<BTreeMap<u32, EventInfo>>,
}

impl Events {
    /// A new login: its own list starts over.
    pub fn new_login(&mut self) {
        self.held = None;
    }

    /// Puts every events list in `classified` together with the one held,
    /// what it says winning; an update of the same run without progress
    /// counters keeps those held, as upstream reads none from it.
    pub fn merge(&mut self, classified: &mut [(u16, CommandMatch)]) {
        for (_, found) in classified.iter_mut() {
            let CommandMatch::Events(list) = found else {
                continue;
            };
            let mut merged = self.held.take().unwrap_or_default();
            for (id, event) in list.iter() {
                let mut event = event.clone();
                // Only for the same run: a new run's counters start over.
                if event.watchers.is_empty()
                    && let Some(held) = merged
                        .get(id)
                        .filter(|held| held.schedule == event.schedule)
                {
                    event.watchers = held.watchers.clone();
                }
                merged.insert(*id, event);
            }
            list.clone_from(&merged);
            self.held = Some(merged);
        }
    }
}

#[cfg(test)]
mod tests {
    use teyvatme_protocol::EventWatcher;

    use super::*;

    fn event(schedule: u32, watchers: &[(u32, u32)]) -> EventInfo {
        EventInfo {
            schedule,
            start: 1,
            end: 2,
            watchers: watchers
                .iter()
                .map(|&(id, progress)| {
                    let watcher = EventWatcher {
                        progress,
                        total: 5,
                        claimed: false,
                    };
                    (id, watcher)
                })
                .collect(),
        }
    }

    fn list(found: &CommandMatch) -> Vec<(u32, u32, usize)> {
        let CommandMatch::Events(list) = found else {
            panic!("not an events list");
        };
        list.iter()
            .map(|(id, event)| (*id, event.schedule, event.watchers.len()))
            .collect()
    }

    #[test]
    fn an_update_of_one_event_keeps_the_rest_of_the_login_list() {
        let mut events = Events::default();
        let login = BTreeMap::from([
            (5002, event(5_002_001, &[])),
            (5294, event(5_294_001, &[])),
            (5352, event(5_352_001, &[(1, 3)])),
        ]);
        let mut first = vec![(26746, CommandMatch::Events(login))];
        events.merge(&mut first);
        assert_eq!(list(&first[0].1).len(), 3);

        // One event moved on: its own fields win, the others stay.
        let update = BTreeMap::from([(5294, event(5_294_002, &[]))]);
        let mut second = vec![(3191, CommandMatch::Events(update))];
        events.merge(&mut second);
        assert_eq!(
            list(&second[0].1),
            vec![
                (5002, 5_002_001, 0),
                (5294, 5_294_002, 0),
                (5352, 5_352_001, 1)
            ]
        );

        // An update without counters keeps the ones held, for the same run only.
        let bare = BTreeMap::from([(5352, event(5_352_001, &[]))]);
        let mut third = vec![(3191, CommandMatch::Events(bare))];
        events.merge(&mut third);
        assert_eq!(list(&third[0].1)[2], (5352, 5_352_001, 1));
        let next_run = BTreeMap::from([(5352, event(5_352_002, &[]))]);
        let mut fourth = vec![(3191, CommandMatch::Events(next_run))];
        events.merge(&mut fourth);
        assert_eq!(list(&fourth[0].1)[2], (5352, 5_352_002, 0));
    }

    #[test]
    fn a_new_login_starts_its_list_over() {
        let mut events = Events::default();
        let mut first = vec![(
            26746,
            CommandMatch::Events(BTreeMap::from([(1, event(1001, &[]))])),
        )];
        events.merge(&mut first);
        events.new_login();
        let mut next = vec![(
            26746,
            CommandMatch::Events(BTreeMap::from([(2, event(2001, &[]))])),
        )];
        events.merge(&mut next);
        assert_eq!(list(&next[0].1), vec![(2, 2001, 0)]);
    }
}
