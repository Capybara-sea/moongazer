// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! What changed between two exports, in the form the app stores: auto sync
//! keeps a login's first export whole and each later one as the changes
//! since the one before. Applied in order onto the first, they rebuild any
//! later one exactly, which its content hash then confirms.
//!
//! Characters are paired by `key`, weapons and artifacts by `gi_guid`, and a
//! path names such an item by that key. Objects are compared field by field.
//! Any other array, and a keyed list with an item that lacks its key or
//! shares it, is one value, compared without regard to order. The top-level
//! `timestamp` is left out.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Map, Value};

use crate::canonical;

/// The top-level lists whose items are paired, the field they are paired
/// by, and the field that names an item in its changes.
const KEYED: [(&str, &str, Option<&str>); 3] = [
    ("characters", "key", None),
    ("weapons", "gi_guid", Some("key")),
    ("artifacts", "gi_guid", Some("setKey")),
];

/// One change. `before` is absent for a path that was added, `after` for one
/// that was removed; a present `null` stays present.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Change {
    #[serde(rename = "p")]
    pub path: Vec<String>,
    #[serde(
        rename = "b",
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "present"
    )]
    pub before: Option<Value>,
    #[serde(
        rename = "a",
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "present"
    )]
    pub after: Option<Value>,
    /// On a change inside a weapon or artifact: the item's `key` or
    /// `setKey`, so it can be named without the export.
    #[serde(rename = "k", default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
}

/// A field that is there, `null` included (serde reads a `null` `Option` as
/// absent).
fn present<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<Value>, D::Error> {
    Value::deserialize(deserializer).map(Some)
}

/// Why changes did not apply. Neither says a value: they are logged.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ApplyError {
    /// A change's path leads nowhere in the document.
    Path,
    /// The document does not hold a change's `before` at its path.
    Before,
}

impl fmt::Display for ApplyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Path => "a change's path is not in the document",
            Self::Before => "a change's old value is not what the document holds",
        })
    }
}

impl std::error::Error for ApplyError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RebuildError {
    /// The export or a batch is not the JSON it should be.
    Json,
    Apply(ApplyError),
    /// The result is not the export the last batch was made from.
    Hash,
}

impl fmt::Display for RebuildError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Json => f.write_str("a stored export or batch is not valid JSON"),
            Self::Apply(err) => err.fmt(f),
            Self::Hash => f.write_str("the rebuilt export is not the one stored"),
        }
    }
}

impl std::error::Error for RebuildError {}

/// Every change from `old` to `new`.
pub fn diff(old: &Value, new: &Value) -> Vec<Change> {
    let mut out = Vec::new();
    let mut path = Vec::new();
    let (Value::Object(old), Value::Object(new)) = (old, new) else {
        walk(&mut out, &mut path, Some(old), Some(new), None);
        return out;
    };
    for name in names(old, new) {
        if name == "timestamp" {
            continue;
        }
        path.push(name.clone());
        let (old, new) = (old.get(name), new.get(name));
        let keyed = KEYED.iter().find(|(list, ..)| list == name);
        match keyed
            .and_then(|&(_, pair, label)| Some((by_key(old?, pair)?, by_key(new?, pair)?, label)))
        {
            Some((old, new, label)) => items(&mut out, &mut path, &old, &new, label),
            None => walk(&mut out, &mut path, old, new, None),
        }
        path.pop();
    }
    out
}

/// Compares what `path` holds on either side.
fn walk(
    out: &mut Vec<Change>,
    path: &mut Vec<String>,
    old: Option<&Value>,
    new: Option<&Value>,
    key: Option<&str>,
) {
    match (old, new) {
        (Some(Value::Object(old)), Some(Value::Object(new))) => {
            for name in names(old, new) {
                path.push(name.clone());
                walk(out, path, old.get(name), new.get(name), key);
                path.pop();
            }
        }
        (None, None) => {}
        (Some(old), Some(new)) if same(old, new) => {}
        _ => out.push(Change {
            path: path.clone(),
            before: old.cloned(),
            after: new.cloned(),
            key: key.map(str::to_owned),
        }),
    }
}

/// Compares two keyed lists item by item. An item added or removed is one
/// change holding it whole.
fn items(
    out: &mut Vec<Change>,
    path: &mut Vec<String>,
    old: &BTreeMap<&str, &Value>,
    new: &BTreeMap<&str, &Value>,
    label: Option<&str>,
) {
    let keys: BTreeSet<&str> = old.keys().chain(new.keys()).copied().collect();
    for item in keys {
        let (old, new) = (old.get(item).copied(), new.get(item).copied());
        let key = label
            .and_then(|label| {
                new.zip(old)
                    .and_then(|(new, old)| new.get(label).or(old.get(label)))
            })
            .and_then(Value::as_str);
        path.push(item.to_owned());
        walk(out, path, old, new, key);
        path.pop();
    }
}

/// The items of `list` by their `pair` field; `None` unless every item is an
/// object with its own string key.
fn by_key<'a>(list: &'a Value, pair: &str) -> Option<BTreeMap<&'a str, &'a Value>> {
    let mut items = BTreeMap::new();
    for item in list.as_array()? {
        let key = item.get(pair)?.as_str()?;
        if items.insert(key, item).is_some() {
            return None;
        }
    }
    Some(items)
}

fn names<'a>(old: &'a Map<String, Value>, new: &'a Map<String, Value>) -> BTreeSet<&'a String> {
    old.keys().chain(new.keys()).collect()
}

fn same(a: &Value, b: &Value) -> bool {
    a == b || canonical::bytes(a) == canonical::bytes(b)
}

/// Applies `changes` to `doc`. Each must find its `before` at its path.
pub fn apply(doc: &mut Value, changes: &[Change]) -> Result<(), ApplyError> {
    changes.iter().try_for_each(|change| apply_one(doc, change))
}

fn apply_one(doc: &mut Value, change: &Change) -> Result<(), ApplyError> {
    let Some((last, parents)) = change.path.split_last() else {
        check(Some(doc), change)?;
        *doc = change.after.clone().ok_or(ApplyError::Path)?;
        return Ok(());
    };
    let mut parent = doc;
    for (depth, part) in parents.iter().enumerate() {
        parent = match parent {
            Value::Object(map) => map.get_mut(part),
            Value::Array(items) => {
                let pair = pair_at(&change.path, depth).ok_or(ApplyError::Path)?;
                let index = position(items, pair, part)?;
                index.and_then(|index| items.get_mut(index))
            }
            _ => None,
        }
        .ok_or(ApplyError::Path)?;
    }
    match parent {
        Value::Object(map) => {
            check(map.get(last), change)?;
            match &change.after {
                Some(after) => map.insert(last.clone(), after.clone()),
                None => map.remove(last),
            };
        }
        Value::Array(items) => {
            let pair = pair_at(&change.path, parents.len()).ok_or(ApplyError::Path)?;
            let index = position(items, pair, last)?;
            check(index.and_then(|index| items.get(index)), change)?;
            match (&change.after, index) {
                (Some(after), Some(index)) => items[index] = after.clone(),
                (Some(after), None) => items.push(after.clone()),
                // Order does not count.
                (None, Some(index)) => {
                    items.swap_remove(index);
                }
                (None, None) => {}
            }
        }
        _ => return Err(ApplyError::Path),
    }
    Ok(())
}

/// The field the items are paired by, for the part at `depth` of `path`:
/// only the items of a top-level keyed list are reached into.
fn pair_at(path: &[String], depth: usize) -> Option<&'static str> {
    if depth != 1 {
        return None;
    }
    KEYED
        .iter()
        .find(|(list, ..)| *list == path[0])
        .map(|&(_, pair, _)| pair)
}

/// Where the item keyed `key` is; two such items is an error.
fn position(items: &[Value], pair: &str, key: &str) -> Result<Option<usize>, ApplyError> {
    let mut found = items
        .iter()
        .enumerate()
        .filter(|(_, item)| item.get(pair).and_then(Value::as_str) == Some(key))
        .map(|(index, _)| index);
    let first = found.next();
    match found.next() {
        Some(_) => Err(ApplyError::Path),
        None => Ok(first),
    }
}

fn check(current: Option<&Value>, change: &Change) -> Result<(), ApplyError> {
    match (current, &change.before) {
        (None, None) => Ok(()),
        (Some(current), Some(before)) if same(current, before) => Ok(()),
        _ => Err(ApplyError::Before),
    }
}

/// Rebuilds the export at `at` (unix ms): `base`, a kept export, with
/// `batches` (each a JSON array of changes) applied in order and its
/// `timestamp` set to `at`. It must hash to `expected`.
pub fn rebuild<'a>(
    base: &[u8],
    batches: impl IntoIterator<Item = &'a [u8]>,
    at: i64,
    expected: &[u8],
) -> Result<String, RebuildError> {
    // serde's errors can quote a value, so they are not passed on.
    let mut doc: Value = serde_json::from_slice(base).map_err(|_| RebuildError::Json)?;
    for batch in batches {
        let changes: Vec<Change> = serde_json::from_slice(batch).map_err(|_| RebuildError::Json)?;
        apply(&mut doc, &changes).map_err(RebuildError::Apply)?;
    }
    if let Value::Object(map) = &mut doc {
        map.insert("timestamp".to_owned(), Value::from(at));
    }
    if canonical::hash(&doc)[..] != *expected {
        return Err(RebuildError::Hash);
    }
    serde_json::to_string(&doc).map_err(|_| RebuildError::Json)
}

#[cfg(test)]
mod tests;
