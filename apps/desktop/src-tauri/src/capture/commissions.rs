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
//! unread.

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

#[cfg(test)]
mod tests {
    use teyvatme_protocol::matches_daily_task_notify;

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
}
