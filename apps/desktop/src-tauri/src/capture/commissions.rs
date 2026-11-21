// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Today's commission list when upstream left its count unread. Beside the
//! list the game sends how many are finished and the city the list belongs
//! to (7.2: `{3: city, 8: count}`), and leaves a 0 out. Upstream tells the
//! two apart by size alone, so it leaves a list unread when both could be
//! the count: a lone number no larger than the list, or two unequal ones
//! (a Sumeru list, city 4, with one to three finished). With it go the
//! progress notifies, which upstream believes only once one agrees with the
//! list's count.
//!
//! A city is never 0, so a lone number is the city and none are finished. Of
//! two, the one that is the city of the list's commissions (by the capture
//! pack's table of their cities) leaves the other as the count.

use std::collections::HashMap;

use teyvatme_protocol::{CommandMatch, GameCommand};

use super::anecdotes::{Field, Value, parse};

/// Gives a list upstream could not count its count, where the numbers beside
/// it tell it. `cities` is the city of each commission by id.
pub fn fill_in(
    classified: &mut [(u16, CommandMatch)],
    commands: &[GameCommand],
    cities: &HashMap<u32, u32>,
) {
    for (id, found) in classified {
        if let CommandMatch::Commissions(list) = found
            && list.finished.is_none()
            && let Some(command) = commands.iter().find(|c| !c.sent && c.command_id == *id)
        {
            list.finished = count(&command.proto_data, cities);
        }
    }
}

fn count(payload: &[u8], cities: &HashMap<u32, u32>) -> Option<u32> {
    let fields = parse(payload)?;
    let numbers: Vec<u64> = fields
        .iter()
        .filter_map(|field| varint(field.value))
        .collect();
    match numbers.as_slice() {
        [_] => Some(0),
        &[a, b] => {
            let city = list_city(&fields, cities)?;
            match (a == city, b == city) {
                (true, false) => u32::try_from(b).ok(),
                (false, true) => u32::try_from(a).ok(),
                _ => None,
            }
        }
        _ => None,
    }
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
    use teyvatme_protocol::{DailyCommissions, matches_daily_task_notify};

    use super::*;

    const IDS: [u64; 4] = [32_280, 32_345, 32_375, 42_230];

    fn varint(mut value: u64, out: &mut Vec<u8>) {
        while value >= 0x80 {
            out.push((value & 0x7f) as u8 | 0x80);
            value >>= 7;
        }
        out.push(value as u8);
    }

    /// A 7.2-shaped list of four (`{7: reward, 11: target, 14: id}`, at 6)
    /// with `numbers` beside it, a 0 left out as the game does.
    fn list(numbers: &[(u64, u64)]) -> Vec<u8> {
        let mut out = Vec::new();
        for id in IDS {
            let mut entry = Vec::new();
            for (number, value) in [(7, 2_112), (11, 1), (14, id)] {
                varint(number << 3, &mut entry);
                varint(value, &mut entry);
            }
            varint(6 << 3 | 2, &mut out);
            varint(entry.len() as u64, &mut out);
            out.extend(entry);
        }
        for &(number, value) in numbers.iter().filter(|(_, value)| *value != 0) {
            varint(number << 3, &mut out);
            varint(value, &mut out);
        }
        out
    }

    /// The four commissions in `city`.
    fn in_city(city: u32) -> HashMap<u32, u32> {
        IDS.iter().map(|&id| (id as u32, city)).collect()
    }

    fn read(payload: Vec<u8>, cities: &HashMap<u32, u32>) -> Option<u32> {
        let found = matches_daily_task_notify(&payload).expect("a commission list");
        let mut classified = vec![(9, CommandMatch::Commissions(found))];
        let command = GameCommand {
            command_id: 9,
            header_len: 0,
            data_len: payload.len() as u32,
            proto_header: Vec::new(),
            proto_data: payload,
            sent: false,
        };
        fill_in(&mut classified, &[command], cities);
        match classified[0].1 {
            CommandMatch::Commissions(DailyCommissions { finished, .. }) => finished,
            _ => unreachable!(),
        }
    }

    #[test]
    fn a_lone_number_is_the_city_and_none_are_finished() {
        // City 4 beside a list of four, none finished: upstream leaves it.
        let upstream = matches_daily_task_notify(&list(&[(3, 4)])).unwrap();
        assert_eq!(upstream.finished, None);
        assert_eq!(read(list(&[(3, 4), (8, 0)]), &HashMap::new()), Some(0));
        assert_eq!(read(list(&[(3, 2)]), &HashMap::new()), Some(0));
        // What upstream reads stays as it is.
        assert_eq!(read(list(&[(3, 6)]), &HashMap::new()), Some(0));
        assert_eq!(read(list(&[(3, 6), (8, 2)]), &HashMap::new()), Some(2));
    }

    #[test]
    fn of_two_numbers_the_commissions_city_leaves_the_count() {
        // Sumeru, two finished: both fit the list, so upstream leaves it.
        let upstream = matches_daily_task_notify(&list(&[(3, 4), (8, 2)])).unwrap();
        assert_eq!(upstream.finished, None);
        assert_eq!(read(list(&[(3, 4), (8, 2)]), &in_city(4)), Some(2));
        assert_eq!(read(list(&[(3, 2), (8, 4)]), &in_city(2)), Some(4));
        // Commissions the table does not know, or of another city: unread.
        assert_eq!(read(list(&[(3, 4), (8, 2)]), &HashMap::new()), None);
        assert_eq!(read(list(&[(3, 4), (8, 2)]), &in_city(3)), None);
        // Commissions of two cities say nothing of the list's.
        let mut mixed = in_city(4);
        mixed.insert(32_280, 2);
        assert_eq!(read(list(&[(3, 4), (8, 2)]), &mixed), None);
    }
}
