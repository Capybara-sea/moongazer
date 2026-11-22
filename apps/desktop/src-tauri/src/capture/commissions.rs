// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Today's commission list when upstream left it unread. Beside the list the
//! game sends how many are finished and the city the player fixed their
//! commissions to (7.2: `{8: count, 3: city}`), and leaves out a 0 and an
//! unfixed city. Upstream tells the two apart by size alone, so it leaves a
//! list uncounted when both could be the count (a lone number no larger than
//! the list, or two unequal ones), and does not know a list with neither as
//! one at all. With it go the progress notifies, which upstream believes only
//! once one agrees with the list's count.
//!
//! A fixed city is the city of the list's commissions (by the capture pack's
//! table of their cities), so a number that is not that city is the count,
//! and of two the other one is. With no number none are finished and no city
//! is fixed. A lone number that is the list's city could be either, and stays
//! unread until the day's progress notify, told at the login by [`Progress`],
//! counts it.

use std::collections::HashMap;

use teyvatme_protocol::{CommandMatch, DailyCommissions, GameCommand};

use super::anecdotes::{Field, Value, parse};

/// A day's commissions. A list with no number beside it is taken only when
/// whole: one commission's progress notify has its shape (7.2: one entry).
const DAILY_COMMISSIONS: usize = 4;

/// Counts the lists upstream could not, where the numbers beside them tell
/// it, and takes a whole list with no number for one with none finished.
/// `cities` is the city of each commission by id.
pub fn fill_in(
    classified: &mut [(u16, CommandMatch)],
    commands: &[GameCommand],
    cities: &HashMap<u32, u32>,
) {
    for (id, found) in classified {
        let Some(command) = commands.iter().find(|c| !c.sent && c.command_id == *id) else {
            continue;
        };
        match found {
            CommandMatch::Commissions(list) => {
                if list.finished.is_none() {
                    list.finished = count(&command.proto_data, cities)
                        .filter(|&finished| finished <= list.total);
                }
            }
            _ => {
                if bare_list(&command.proto_data, cities) {
                    *found = CommandMatch::Commissions(DailyCommissions {
                        total: DAILY_COMMISSIONS as u32,
                        finished: Some(0),
                    });
                }
            }
        }
    }
}

fn count(payload: &[u8], cities: &HashMap<u32, u32>) -> Option<u32> {
    let fields = parse(payload)?;
    let city = list_city(&fields, cities)?;
    let numbers: Vec<u64> = fields
        .iter()
        .filter_map(|field| varint(field.value))
        .collect();
    let finished = match *numbers.as_slice() {
        [only] if only != city => only,
        [a, b] if a == city && b != city => b,
        [a, b] if b == city && a != city => a,
        _ => return None,
    };
    u32::try_from(finished).ok()
}

/// Whether `payload` is nothing but a day's commissions, each of one city.
fn bare_list(payload: &[u8], cities: &HashMap<u32, u32>) -> bool {
    let Some(fields) = parse(payload) else {
        return false;
    };
    if fields.len() != DAILY_COMMISSIONS
        || fields.iter().any(|field| field.number != fields[0].number)
    {
        return false;
    }
    let mut ids = Vec::new();
    for field in &fields {
        let Value::Bytes(entry) = field.value else {
            return false;
        };
        let Some(entry) = parse(entry) else {
            return false;
        };
        let Some(values) = entry
            .iter()
            .map(|field| varint(field.value))
            .collect::<Option<Vec<_>>>()
        else {
            return false;
        };
        let known: Vec<u64> = values
            .into_iter()
            .filter(|&value| u32::try_from(value).is_ok_and(|id| cities.contains_key(&id)))
            .collect();
        let [id] = known[..] else {
            return false;
        };
        if ids.contains(&id) {
            return false;
        }
        ids.push(id);
    }
    list_city(&fields, cities).is_some()
}

/// The city every known commission in the list belongs to; None when none
/// is known or they disagree. Only the commission ids are keys of `cities`:
/// the entries' other numbers (the reward, the counters) are far smaller.
fn list_city(fields: &[Field<'_>], cities: &HashMap<u32, u32>) -> Option<u64> {
    let mut city = None;
    for field in fields {
        let Value::Bytes(entry) = field.value else {
            continue;
        };
        for value in parse(entry)?.iter().filter_map(|field| varint(field.value)) {
            let Some(&found) = u32::try_from(value).ok().and_then(|id| cities.get(&id)) else {
                continue;
            };
            if city.is_some_and(|city| city != found) {
                return None;
            }
            city = Some(found);
        }
    }
    city.map(u64::from)
}

fn varint(value: Value<'_>) -> Option<u64> {
    match value {
        Value::Varint(value) => Some(value),
        _ => None,
    }
}

/// How many progress notifies upstream wants to agree with the list it holds
/// before it believes them (`COMMISSION_AGREEMENTS` in teyvatme-core's
/// player_data.rs, not public). Should it ask for more, the notify is
/// learned later, as it was before.
const AGREEMENTS: usize = 3;

/// How long after a login's list its progress notify is still told by its
/// reward: the game sends one just before the list and one right after it,
/// and another message with the same reward only later (7.2: when
/// Katheryne's reward is taken).
const BESIDE_THE_LIST_MS: u64 = 1_000;

/// The day's progress notify, told at each login and taught to upstream at
/// once.
///
/// Upstream learns which candidate is the notify only once three agree with
/// the list it holds, all before the count moves: a list it cannot count, or
/// a commission done soon after logging in, and it does not that session.
/// At a login the game sends the notify just before the list and again right
/// after it, with the day's count and whether Katheryne's reward was taken,
/// and on it the id of that reward for the player's Adventure Rank, which
/// nothing else sent then carries. Its count becomes the list's, and it is
/// handed to upstream as many times as upstream needs to believe it.
pub struct Progress {
    /// `[lowest, highest, reward id]` for each range of Adventure Ranks.
    rewards: Vec<[u32; 3]>,
    /// This login's list as upstream holds it.
    list: Option<DailyCommissions>,
    /// When this login's list first came.
    listed_at: Option<u64>,
    /// The command this login's notifies come on.
    notify: Option<u16>,
    /// The notify upstream was taught, and its reward: upstream keeps what it
    /// learned from one login to the next.
    taught: Option<(u16, u32)>,
}

impl Progress {
    pub fn new(rewards: Vec<[u32; 3]>) -> Self {
        Self {
            rewards,
            list: None,
            listed_at: None,
            notify: None,
            taught: None,
        }
    }

    /// A new login, whose list and notify are told afresh.
    pub fn new_login(&mut self) {
        self.list = None;
        self.listed_at = None;
        self.notify = None;
    }

    /// Goes through what is about to be applied, received at `at_ms`: tells
    /// the notify, and gives upstream its count as the list's and the notify
    /// as many times as it needs. `rank` is the player's Adventure Rank, asked
    /// for only when a candidate carries a reward of the table.
    pub fn teach(
        &mut self,
        classified: &mut Vec<(u16, CommandMatch)>,
        at_ms: u64,
        rank: impl Fn() -> Option<u32>,
    ) {
        let mut out = Vec::with_capacity(classified.len());
        for (id, found) in classified.drain(..) {
            match &found {
                CommandMatch::Commissions(list) => {
                    self.list = Some(*list);
                    self.listed_at.get_or_insert(at_ms);
                }
                CommandMatch::CommissionProgress(progress) => {
                    let reward = progress.reward_id;
                    if self.notify.is_none()
                        && self
                            .listed_at
                            .is_none_or(|listed| at_ms <= listed + BESIDE_THE_LIST_MS)
                        && self.rewards.iter().any(|row| row[2] == reward)
                        && rank().and_then(|rank| self.reward_for(rank)) == Some(reward)
                    {
                        self.notify = Some(id);
                    }
                    if self.notify == Some(id)
                        && let Some(list) = self.list
                        && let Some(finished) = finished(&progress.counts, list.total)
                    {
                        let held = DailyCommissions {
                            finished: Some(finished),
                            ..list
                        };
                        self.list = Some(held);
                        if self.taught != Some((id, reward)) {
                            self.taught = Some((id, reward));
                            if list.finished != held.finished {
                                out.push((id, CommandMatch::Commissions(held)));
                            }
                            for _ in 1..AGREEMENTS {
                                out.push((id, CommandMatch::CommissionProgress(progress.clone())));
                            }
                        }
                    }
                }
                _ => {}
            }
            out.push((id, found));
        }
        *classified = out;
    }

    fn reward_for(&self, rank: u32) -> Option<u32> {
        self.rewards
            .iter()
            .find(|[lowest, highest, _]| (*lowest..=*highest).contains(&rank))
            .map(|row| row[2])
    }
}

/// The count a notify says for a list of `total`, read as upstream reads it:
/// none, the count, or all of them with the reward taken.
fn finished(counts: &[u32], total: u32) -> Option<u32> {
    match *counts {
        [] => Some(0),
        [count] if count <= total => Some(count),
        [a, b] if (a, b) == (total, 1) || (a, b) == (1, total) => Some(total),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use teyvatme_protocol::{CommissionProgress, matches_daily_task_notify};

    use super::*;

    const IDS: [u64; 4] = [32_280, 32_345, 32_375, 42_230];

    fn varint(mut value: u64, out: &mut Vec<u8>) {
        while value >= 0x80 {
            out.push((value & 0x7f) as u8 | 0x80);
            value >>= 7;
        }
        out.push(value as u8);
    }

    /// A 7.2-shaped message of `ids` at `at` (`{7: reward, 11: target, 14:
    /// id}`) with `numbers` beside them, a 0 left out as the game does.
    fn message(at: u64, ids: &[u64], numbers: &[(u64, u64)]) -> Vec<u8> {
        let mut out = Vec::new();
        for &id in ids {
            let mut entry = Vec::new();
            for (number, value) in [(7, 2_112), (11, 1), (14, id)] {
                varint(number << 3, &mut entry);
                varint(value, &mut entry);
            }
            varint(at << 3 | 2, &mut out);
            varint(entry.len() as u64, &mut out);
            out.extend(entry);
        }
        for &(number, value) in numbers.iter().filter(|(_, value)| *value != 0) {
            varint(number << 3, &mut out);
            varint(value, &mut out);
        }
        out
    }

    /// The day's list, at 6 as in 7.2, with the count at 8 and a fixed city
    /// at 3.
    fn list(numbers: &[(u64, u64)]) -> Vec<u8> {
        message(6, &IDS, numbers)
    }

    /// The four commissions in `city`.
    fn in_city(city: u32) -> HashMap<u32, u32> {
        IDS.iter().map(|&id| (id as u32, city)).collect()
    }

    /// What `found`, upstream's reading of `payload`, becomes.
    fn after(payload: Vec<u8>, found: CommandMatch, cities: &HashMap<u32, u32>) -> CommandMatch {
        let mut classified = vec![(9, found)];
        let command = GameCommand {
            command_id: 9,
            header_len: 0,
            data_len: payload.len() as u32,
            proto_header: Vec::new(),
            proto_data: payload,
            sent: false,
        };
        fill_in(&mut classified, &[command], cities);
        classified.remove(0).1
    }

    fn read(payload: Vec<u8>, cities: &HashMap<u32, u32>) -> Option<u32> {
        let found = matches_daily_task_notify(&payload).expect("a commission list");
        match after(payload, CommandMatch::Commissions(found), cities) {
            CommandMatch::Commissions(DailyCommissions { finished, .. }) => finished,
            _ => unreachable!(),
        }
    }

    #[test]
    fn a_lone_number_other_than_the_lists_city_is_the_count() {
        // Fontaine, no city fixed, two finished: upstream leaves it.
        let upstream = matches_daily_task_notify(&list(&[(8, 2)])).unwrap();
        assert_eq!(upstream.finished, None);
        assert_eq!(read(list(&[(8, 2)]), &in_city(5)), Some(2));
        // Sumeru fixed and none finished, or none fixed and four: unread.
        assert_eq!(read(list(&[(3, 4)]), &in_city(4)), None);
        assert_eq!(read(list(&[(8, 4)]), &in_city(4)), None);
        assert_eq!(read(list(&[(8, 2)]), &HashMap::new()), None);
        // What upstream reads stays as it is.
        assert_eq!(read(list(&[(3, 6)]), &HashMap::new()), Some(0));
        assert_eq!(read(list(&[(3, 6), (8, 2)]), &HashMap::new()), Some(2));
    }

    #[test]
    fn of_two_numbers_the_lists_city_leaves_the_count() {
        // Sumeru fixed, two finished: both fit the list, so upstream leaves it.
        let upstream = matches_daily_task_notify(&list(&[(3, 4), (8, 2)])).unwrap();
        assert_eq!(upstream.finished, None);
        assert_eq!(read(list(&[(3, 4), (8, 2)]), &in_city(4)), Some(2));
        assert_eq!(read(list(&[(3, 2), (8, 4)]), &in_city(2)), Some(4));
        // Commissions the table does not know, or numbers that are not their
        // city: unread.
        assert_eq!(read(list(&[(3, 4), (8, 2)]), &HashMap::new()), None);
        assert_eq!(read(list(&[(3, 4), (8, 2)]), &in_city(3)), None);
        // Commissions of two cities say nothing of the list's.
        let mut mixed = in_city(4);
        mixed.insert(32_280, 2);
        assert_eq!(read(list(&[(3, 4), (8, 2)]), &mixed), None);
    }

    #[test]
    fn a_whole_list_with_no_number_has_none_finished() {
        // No city fixed, none finished: upstream does not know it as a list.
        assert_eq!(matches_daily_task_notify(&list(&[])), None);
        let other = || CommandMatch::ClientVersion(String::new());
        assert!(matches!(
            after(list(&[]), other(), &in_city(5)),
            CommandMatch::Commissions(DailyCommissions {
                total: 4,
                finished: Some(0)
            })
        ));
        // One commission's progress has the same shape.
        let one = message(2, &IDS[..1], &[]);
        assert!(matches!(
            after(one, other(), &in_city(5)),
            CommandMatch::ClientVersion(_)
        ));
        // Commissions the table does not know, or of two cities.
        assert!(matches!(
            after(list(&[]), other(), &HashMap::new()),
            CommandMatch::ClientVersion(_)
        ));
        let mut mixed = in_city(5);
        mixed.insert(32_280, 2);
        assert!(matches!(
            after(list(&[]), other(), &mixed),
            CommandMatch::ClientVersion(_)
        ));
    }

    const REWARDS: [[u32; 3]; 2] = [[31, 35, 2_007], [56, 60, 2_012]];

    fn notify(reward_id: u32, counts: &[u32]) -> CommandMatch {
        CommandMatch::CommissionProgress(CommissionProgress {
            reward_id,
            counts: counts.to_vec(),
        })
    }

    fn held(finished: Option<u32>) -> CommandMatch {
        CommandMatch::Commissions(DailyCommissions { total: 4, finished })
    }

    /// What `teach` hands upstream for one batch, received at `at_ms`, from a
    /// player of rank 33.
    fn teach(progress: &mut Progress, batch: Vec<(u16, CommandMatch)>, at_ms: u64) -> Vec<String> {
        let mut batch = batch;
        progress.teach(&mut batch, at_ms, || Some(33));
        batch
            .iter()
            .map(|(id, found)| match found {
                CommandMatch::Commissions(list) => format!("{id} list {:?}", list.finished),
                CommandMatch::CommissionProgress(found) => {
                    format!("{id} notify {} {:?}", found.reward_id, found.counts)
                }
                other => format!("{id} {}", other.kind()),
            })
            .collect()
    }

    #[test]
    fn the_notify_beside_a_login_list_counts_it_and_is_taught() {
        let mut progress = Progress::new(REWARDS.to_vec());
        // Before the list: told, with nothing to count yet.
        assert_eq!(
            teach(&mut progress, vec![(5, notify(2_007, &[]))], 0),
            ["5 notify 2007 []"]
        );
        // A list upstream could not count, then the notify right after it.
        assert_eq!(
            teach(&mut progress, vec![(9, held(None))], 2_000),
            ["9 list None"]
        );
        assert_eq!(
            teach(&mut progress, vec![(5, notify(2_007, &[]))], 2_100),
            [
                "5 list Some(0)",
                "5 notify 2007 []",
                "5 notify 2007 []",
                "5 notify 2007 []"
            ]
        );
        // Once taught, upstream believes it: later ones go through once.
        assert_eq!(
            teach(&mut progress, vec![(5, notify(2_007, &[1]))], 90_000),
            ["5 notify 2007 [1]"]
        );
        // So it does at the next login, even with a list it cannot count.
        progress.new_login();
        assert_eq!(
            teach(&mut progress, vec![(9, held(None))], 200_000),
            ["9 list None"]
        );
        assert_eq!(
            teach(&mut progress, vec![(5, notify(2_007, &[2]))], 200_100),
            ["5 notify 2007 [2]"]
        );
    }

    #[test]
    fn a_list_already_counted_is_not_given_again() {
        let mut progress = Progress::new(REWARDS.to_vec());
        assert_eq!(
            teach(&mut progress, vec![(9, held(Some(2)))], 0),
            ["9 list Some(2)"]
        );
        assert_eq!(
            teach(&mut progress, vec![(5, notify(2_007, &[2]))], 100),
            [
                "5 notify 2007 [2]",
                "5 notify 2007 [2]",
                "5 notify 2007 [2]"
            ]
        );
    }

    #[test]
    fn another_reward_or_a_later_message_is_not_the_notify() {
        let mut progress = Progress::new(REWARDS.to_vec());
        // Another rank's reward (7.2: 25995 with 2005, right after the list).
        assert_eq!(
            teach(&mut progress, vec![(9, held(None))], 0),
            ["9 list None"]
        );
        assert_eq!(
            teach(&mut progress, vec![(7, notify(2_005, &[1]))], 200),
            ["7 notify 2005 [1]"]
        );
        // The player's reward, long after the list (7.2: 26619, when it is taken).
        assert_eq!(
            teach(&mut progress, vec![(8, notify(2_007, &[]))], 45_000),
            ["8 notify 2007 []"]
        );
        // Nor without the player's rank.
        let mut progress = Progress::new(REWARDS.to_vec());
        let mut batch = vec![(9, held(None)), (5, notify(2_007, &[]))];
        progress.teach(&mut batch, 0, || None);
        assert_eq!(batch.len(), 2);
    }

    #[test]
    fn a_taken_reward_reads_as_all_done() {
        assert_eq!(finished(&[], 4), Some(0));
        assert_eq!(finished(&[3], 4), Some(3));
        assert_eq!(finished(&[1, 4], 4), Some(4));
        assert_eq!(finished(&[4, 1], 4), Some(4));
        assert_eq!(finished(&[5], 4), None);
        assert_eq!(finished(&[2, 1], 4), None);
    }
}
