// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The Travel Accounts book while playing. Upstream reads the whole book,
//! which the server sends once, at login; opening the book later shows what
//! the game already has. Recording an anecdote, or taking the reward, sends
//! small notifies instead: one with the anecdotes that moved, one with the
//! reward track. Upstream labels them `Flat`, a message it did not know.
//!
//! Both reuse a type of the login's message. An entry (7.2: `{13: id, 9:
//! state, 6: finish count}`) has field numbers that change with every game
//! version, so they are learned from the login's message, and a notify is
//! taken only when it holds those fields and nothing else. The reward track
//! is read by meaning, as upstream reads it (progress = how many anecdotes it
//! lists, target = the game's constant, a flag once it is full), so a
//! notify's track takes the place of the login message's and upstream reads
//! that message again.

use std::collections::{BTreeMap, BTreeSet};

use teyvatme_protocol::{
    ANECDOTE_IDS, Anecdote, AnecdoteData, MAX_ANECDOTE_FINISH_COUNT, MAX_ANECDOTE_STATE,
    matches_anecdote_get_data_rsp,
};

/// More anecdotes than one notify carries.
const MAX_ENTRIES: usize = 20;
/// The reward track holds one item id, the reward's; its counters are small.
const MIN_ITEM_ID: u64 = 1_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct EntryFields {
    id: u64,
    state: u64,
    count: u64,
}

pub struct Book {
    data: AnecdoteData,
    entry: Option<EntryFields>,
    /// The login's message without its reward track, and the track's field
    /// number there.
    without_track: Option<(Vec<u8>, u64)>,
}

impl Book {
    /// The book upstream read from the login's message, whose payload is `raw`.
    pub fn new(data: AnecdoteData, raw: &[u8]) -> Self {
        let fields = parse(raw).unwrap_or_default();
        Self {
            entry: learn_entry(&fields, &data),
            without_track: track_slot(&fields, &data),
            data,
        }
    }

    pub fn data(&self) -> &AnecdoteData {
        &self.data
    }

    /// Applies `raw`, a server message, when it is one of the book's
    /// notifies; true when the book changed.
    pub fn update(&mut self, raw: &[u8]) -> bool {
        let Some(fields) = parse(raw) else {
            return false;
        };
        let Some(first) = fields.first() else {
            return false;
        };
        let bodies: Option<Vec<&[u8]>> = fields
            .iter()
            .map(|field| match field.value {
                Value::Bytes(body) if field.number == first.number => Some(body),
                _ => None,
            })
            .collect();
        let Some(bodies) = bodies else {
            return false;
        };
        self.update_entries(&bodies) || self.update_track(&bodies)
    }

    fn update_entries(&mut self, bodies: &[&[u8]]) -> bool {
        let Some(fields) = self.entry else {
            return false;
        };
        if bodies.len() > MAX_ENTRIES {
            return false;
        }
        let entries: Option<Vec<Anecdote>> = bodies
            .iter()
            .map(|body| {
                let values = varints(body)?;
                let known = [fields.id, fields.state, fields.count];
                if !values.keys().all(|number| known.contains(number)) {
                    return None;
                }
                let get = |number| u32::try_from(values.get(&number).copied().unwrap_or(0)).ok();
                let entry = Anecdote {
                    id: get(fields.id)?,
                    state: get(fields.state)?,
                    finish_count: get(fields.count)?,
                };
                (ANECDOTE_IDS.contains(&entry.id)
                    && entry.state <= MAX_ANECDOTE_STATE
                    && entry.finish_count <= MAX_ANECDOTE_FINISH_COUNT)
                    .then_some(entry)
            })
            .collect();
        let Some(entries) = entries else {
            return false;
        };
        let mut changed = false;
        for entry in entries {
            match self
                .data
                .anecdotes
                .iter_mut()
                .find(|held| held.id == entry.id)
            {
                Some(held) if *held == entry => {}
                Some(held) => {
                    *held = entry;
                    changed = true;
                }
                None => {
                    self.data.anecdotes.push(entry);
                    changed = true;
                }
            }
        }
        changed
    }

    fn update_track(&mut self, bodies: &[&[u8]]) -> bool {
        let (Some((rest, number)), Some(held), [body]) =
            (&self.without_track, self.data.reward, bodies)
        else {
            return false;
        };
        // Cheap first: a track holds the target and exactly one item id.
        let Some(fields) = parse(body) else {
            return false;
        };
        let values: Vec<u64> = fields
            .iter()
            .filter_map(|field| match field.value {
                Value::Varint(value) => Some(value),
                _ => None,
            })
            .collect();
        if !values.contains(&u64::from(held.target))
            || values.iter().filter(|&&value| value >= MIN_ITEM_ID).count() != 1
        {
            return false;
        }
        let mut message = rest.clone();
        put_bytes(*number, body, &mut message);
        let Some(read) = matches_anecdote_get_data_rsp(&message).and_then(|data| data.reward)
        else {
            return false;
        };
        if read == held {
            return false;
        }
        self.data.reward = Some(read);
        true
    }
}

/// The entry type's numbers: the repeated field with one message per
/// anecdote, in which one field holds the ids and two others always equal the
/// state and the finish count (a field left out is 0). None when that is not
/// one answer.
fn learn_entry(fields: &[Field], data: &AnecdoteData) -> Option<EntryFields> {
    let held: BTreeMap<u32, &Anecdote> = data.anecdotes.iter().map(|a| (a.id, a)).collect();
    if held.is_empty() {
        return None;
    }
    let numbers: BTreeSet<u64> = fields.iter().map(|field| field.number).collect();
    let mut found = None;
    for number in numbers {
        let Some(entries) = fields
            .iter()
            .filter(|field| field.number == number)
            .map(|field| match field.value {
                Value::Bytes(body) => varints(body),
                _ => None,
            })
            .collect::<Option<Vec<_>>>()
        else {
            continue;
        };
        if entries.len() != held.len() {
            continue;
        }
        let inner: BTreeSet<u64> = entries
            .iter()
            .flat_map(|values| values.keys().copied())
            .collect();
        let value = |values: &BTreeMap<u64, u64>, number| values.get(&number).copied().unwrap_or(0);
        for &id in &inner {
            let by_id: Option<Vec<(&Anecdote, &BTreeMap<u64, u64>)>> = entries
                .iter()
                .map(|values| {
                    let id = u32::try_from(value(values, id)).ok()?;
                    Some((*held.get(&id)?, values))
                })
                .collect();
            let Some(by_id) = by_id else {
                continue;
            };
            let only = |of: fn(&Anecdote) -> u32| {
                let mut matching = inner.iter().copied().filter(|&number| {
                    number != id
                        && by_id
                            .iter()
                            .all(|(held, values)| value(values, number) == u64::from(of(held)))
                });
                let first = matching.next();
                if matching.next().is_some() {
                    None
                } else {
                    first
                }
            };
            let (Some(state), Some(count)) = (only(|a| a.state), only(|a| a.finish_count)) else {
                continue;
            };
            if state == count || found.is_some() {
                return None;
            }
            found = Some(EntryFields { id, state, count });
        }
    }
    found
}

/// The login's message without the reward track, and the track's number: the
/// one field without which upstream still reads the message but no track.
fn track_slot(fields: &[Field], data: &AnecdoteData) -> Option<(Vec<u8>, u64)> {
    data.reward?;
    let mut found = None;
    for field in fields {
        let Value::Bytes(_) = field.value else {
            continue;
        };
        if fields.iter().filter(|f| f.number == field.number).count() != 1 {
            continue;
        }
        let rest = encode(fields.iter().filter(|f| f.number != field.number))?;
        if matches_anecdote_get_data_rsp(&rest).is_some_and(|read| read.reward.is_none()) {
            if found.is_some() {
                return None;
            }
            found = Some((rest, field.number));
        }
    }
    found
}

#[derive(Clone, Copy, Debug)]
enum Value<'a> {
    Varint(u64),
    Bytes(&'a [u8]),
    Fixed,
}

#[derive(Clone, Copy, Debug)]
struct Field<'a> {
    number: u64,
    value: Value<'a>,
}

/// A message's fields in order, or None when it is not one.
fn parse(bytes: &[u8]) -> Option<Vec<Field<'_>>> {
    let mut fields = Vec::new();
    let mut at = 0;
    while at < bytes.len() {
        let key = read_varint(bytes, &mut at)?;
        let number = key >> 3;
        let value = match key & 7 {
            0 => Value::Varint(read_varint(bytes, &mut at)?),
            1 | 5 => {
                at = at.checked_add(if key & 7 == 1 { 8 } else { 4 })?;
                Value::Fixed
            }
            2 => {
                let len = usize::try_from(read_varint(bytes, &mut at)?).ok()?;
                let end = at.checked_add(len)?;
                let body = bytes.get(at..end)?;
                at = end;
                Value::Bytes(body)
            }
            _ => return None,
        };
        if number == 0 || at > bytes.len() {
            return None;
        }
        fields.push(Field { number, value });
    }
    Some(fields)
}

/// The fields as a message again; None for a fixed-size one, which the
/// login's message has none of.
fn encode<'a>(fields: impl Iterator<Item = &'a Field<'a>>) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    for field in fields {
        match field.value {
            Value::Varint(value) => {
                put_varint(field.number << 3, &mut out);
                put_varint(value, &mut out);
            }
            Value::Bytes(body) => put_bytes(field.number, body, &mut out),
            Value::Fixed => return None,
        }
    }
    Some(out)
}

fn put_varint(mut value: u64, out: &mut Vec<u8>) {
    loop {
        let byte = (value & 0x7f) as u8;
        value >>= 7;
        if value == 0 {
            out.push(byte);
            return;
        }
        out.push(byte | 0x80);
    }
}

fn put_bytes(number: u64, body: &[u8], out: &mut Vec<u8>) {
    put_varint(number << 3 | 2, out);
    put_varint(body.len() as u64, out);
    out.extend_from_slice(body);
}

/// A message of varints only, by number; None for anything else or a repeat.
fn varints(bytes: &[u8]) -> Option<BTreeMap<u64, u64>> {
    let mut values = BTreeMap::new();
    for field in parse(bytes)? {
        let Value::Varint(value) = field.value else {
            return None;
        };
        if values.insert(field.number, value).is_some() {
            return None;
        }
    }
    Some(values)
}

fn read_varint(bytes: &[u8], at: &mut usize) -> Option<u64> {
    let mut value = 0u64;
    for shift in (0..64).step_by(7) {
        let byte = *bytes.get(*at)?;
        *at += 1;
        value |= u64::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 {
            return Some(value);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use teyvatme_protocol::AnecdoteReward;

    use super::*;

    /// A message of varint fields; a 0 is left out, as the game does.
    fn message(fields: &[(u64, u64)]) -> Vec<u8> {
        let mut out = Vec::new();
        for &(number, value) in fields {
            if value != 0 {
                put_varint(number << 3, &mut out);
                put_varint(value, &mut out);
            }
        }
        out
    }

    fn packed(values: &[u64]) -> Vec<u8> {
        let mut out = Vec::new();
        for &value in values {
            put_varint(value, &mut out);
        }
        out
    }

    fn entry(id: u32, state: u32, finish_count: u32) -> Anecdote {
        Anecdote {
            id,
            state,
            finish_count,
        }
    }

    const ENTRIES: [Anecdote; 5] = [
        Anecdote {
            id: 110_001,
            state: 3,
            finish_count: 1,
        },
        Anecdote {
            id: 110_002,
            state: 2,
            finish_count: 1,
        },
        Anecdote {
            id: 120_003,
            state: 2,
            finish_count: 0,
        },
        Anecdote {
            id: 130_004,
            state: 0,
            finish_count: 0,
        },
        Anecdote {
            id: 130_005,
            state: 3,
            finish_count: 2,
        },
    ];
    const REWARD_ID: u64 = 245_990;

    /// The reward track as 7.2 has it: the anecdotes recorded toward it
    /// (packed, under 1), the target (3), the progress (6), the reward (7),
    /// the index (11) and, once full, a flag (13).
    fn track(index: u64, recorded: usize) -> Vec<u8> {
        let ids: Vec<u64> = (0..recorded as u64).map(|i| 150_000 + i).collect();
        let mut out = Vec::new();
        if recorded > 0 {
            put_bytes(1, &packed(&ids), &mut out);
        }
        out.extend(message(&[
            (3, 10),
            (6, recorded as u64),
            (7, REWARD_ID),
            (11, index),
            (13, u64::from(recorded >= 10)),
        ]));
        out
    }

    /// A login message as 7.2 sends it: entries `{13: id, 9: state, 6:
    /// count}` under 7, the area tabs under 2, the reward track under 8 and
    /// the wish under 14. Read by upstream, as the decoder has it.
    fn login(index: u64, recorded: usize) -> (AnecdoteData, Vec<u8>) {
        let mut raw = Vec::new();
        for a in ENTRIES {
            let body = message(&[
                (13, u64::from(a.id)),
                (9, u64::from(a.state)),
                (6, u64::from(a.finish_count)),
            ]);
            put_bytes(7, &body, &mut raw);
        }
        let mut areas = Vec::new();
        put_bytes(9, &packed(&[1, 2, 3]), &mut areas);
        put_bytes(2, &areas, &mut raw);
        put_bytes(8, &track(index, recorded), &mut raw);
        put_bytes(14, &message(&[(6, 1_750_000_000)]), &mut raw);
        let data = matches_anecdote_get_data_rsp(&raw).expect("upstream reads the login message");
        (data, raw)
    }

    fn book(index: u64, recorded: usize) -> Book {
        let (data, raw) = login(index, recorded);
        Book::new(data, &raw)
    }

    fn notify(number: u64, bodies: &[Vec<u8>]) -> Vec<u8> {
        let mut raw = Vec::new();
        for body in bodies {
            put_bytes(number, body, &mut raw);
        }
        raw
    }

    fn reward(index: u32, progress: u32) -> Option<AnecdoteReward> {
        Some(AnecdoteReward {
            index,
            progress,
            target: 10,
        })
    }

    #[test]
    fn the_entry_numbers_and_the_track_are_found_in_the_login_message() {
        let book = book(15, 8);
        assert_eq!(
            book.entry,
            Some(EntryFields {
                id: 13,
                state: 9,
                count: 6
            })
        );
        assert_eq!(
            book.without_track.as_ref().map(|(_, number)| *number),
            Some(8)
        );
        assert_eq!(book.data().reward, reward(15, 8));
    }

    #[test]
    fn a_recorded_anecdote_moves_its_entry() {
        let mut book = book(15, 8);
        assert!(book.update(&notify(2, &[message(&[(9, 3), (6, 2), (13, 110_002)])])));
        assert!(book.data().anecdotes.contains(&entry(110_002, 3, 2)));
        // The same again changes nothing.
        assert!(!book.update(&notify(2, &[message(&[(9, 3), (6, 2), (13, 110_002)])])));
    }

    #[test]
    fn an_anecdote_met_for_the_first_time_is_added() {
        let mut book = book(15, 8);
        assert!(book.update(&notify(2, &[message(&[(9, 2), (13, 140_005)])])));
        assert!(book.data().anecdotes.contains(&entry(140_005, 2, 0)));
    }

    #[test]
    fn the_track_moves_to_full_and_starts_over_once_taken() {
        let mut book = book(15, 8);
        assert!(book.update(&notify(15, &[track(15, 9)])));
        assert_eq!(book.data().reward, reward(15, 9));
        // Full: the track gains a flag the login's did not have.
        assert!(book.update(&notify(15, &[track(15, 10)])));
        assert_eq!(book.data().reward, reward(15, 10));
        // Taken: the next exchange, nothing recorded toward it.
        assert!(book.update(&notify(15, &[track(16, 0)])));
        assert_eq!(book.data().reward, reward(16, 0));
        assert!(!book.update(&notify(15, &[track(16, 0)])));
    }

    #[test]
    fn a_login_with_a_full_track_still_follows_it() {
        let mut book = book(15, 10);
        assert_eq!(book.data().reward, reward(15, 10));
        assert!(book.update(&notify(15, &[track(16, 0)])));
        assert_eq!(book.data().reward, reward(16, 0));
    }

    #[test]
    fn messages_of_other_shapes_are_left_alone() {
        let mut book = book(15, 8);
        let before = book.data().clone();
        for raw in [
            // Map entries {1: key, 2: value}, keys in the anecdote block.
            notify(3, &[message(&[(1, 110_001), (2, 5)])]),
            // Another field next to the entry's.
            notify(2, &[message(&[(9, 3), (13, 110_002), (11, 1)])]),
            // An id outside the block.
            notify(2, &[message(&[(9, 3), (13, 42)])]),
            // The id alone at the top, as the finish request's answer has it.
            message(&[(11, 110_002)]),
            // An entry next to something else.
            [
                notify(2, &[message(&[(9, 3), (13, 110_002)])]),
                message(&[(4, 1)]),
            ]
            .concat(),
            // A track-like message with no target, or two item ids.
            notify(15, &[message(&[(3, 20), (7, REWARD_ID), (11, 15)])]),
            notify(
                15,
                &[message(&[
                    (3, 10),
                    (7, REWARD_ID),
                    (8, REWARD_ID),
                    (11, 15),
                ])],
            ),
            // Two tracks.
            notify(15, &[track(15, 9), track(15, 9)]),
            b"not a message".to_vec(),
        ] {
            assert!(!book.update(&raw));
        }
        assert_eq!(book.data(), &before);
    }

    #[test]
    fn entries_whose_values_do_not_tell_the_fields_apart_teach_nothing() {
        let data = AnecdoteData {
            anecdotes: vec![entry(110_001, 3, 3), entry(110_002, 2, 2)],
            ..AnecdoteData::default()
        };
        let mut raw = Vec::new();
        for a in &data.anecdotes {
            let body = message(&[
                (13, u64::from(a.id)),
                (9, u64::from(a.state)),
                (6, u64::from(a.finish_count)),
            ]);
            put_bytes(7, &body, &mut raw);
        }
        let mut book = Book::new(data, &raw);
        assert_eq!(book.entry, None);
        assert!(!book.update(&notify(2, &[message(&[(9, 3), (6, 3), (13, 110_002)])])));
    }
}
