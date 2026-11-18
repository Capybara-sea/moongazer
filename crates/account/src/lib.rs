// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Account exports: Leyline files (GOOD plus `gi_*` keys), as Teyvat.me
//! Capture and the app's auto sync write them.

mod canonical;
pub mod delta;
mod good;

use std::collections::BTreeSet;

use serde::Serialize;
use serde_json::Value;

pub use good::{Artifact, Character, Good, Player, Substat, Talent, Weapon};

/// The GOOD versions Genshin Optimizer itself accepts.
const VERSIONS: std::ops::RangeInclusive<u64> = 1..=3;

#[derive(Debug)]
pub enum ParseError {
    /// Not JSON, or a field of the wrong type. serde's message has the line
    /// and column, and may quote a value from the file.
    Json(serde_json::Error),
    NotGood,
    UnsupportedVersion(u64),
    /// GOOD without Leyline's keys: too little for the pages.
    NotLeyline,
}

/// A parsed export.
#[derive(Debug)]
pub struct Export {
    pub data: Good,
    /// SHA-256 of the whole file with object keys and array items sorted:
    /// Capture writes both in a different order every time.
    pub content_hash: [u8; 32],
    /// The whole file, for working out what changed between two.
    pub value: Value,
}

pub fn parse(bytes: &[u8]) -> Result<Export, ParseError> {
    let value: Value = serde_json::from_slice(bytes).map_err(ParseError::Json)?;
    if value.get("format").and_then(Value::as_str) != Some("GOOD") {
        return Err(ParseError::NotGood);
    }
    let version = value.get("version").and_then(Value::as_u64).unwrap_or(0);
    if !VERSIONS.contains(&version) {
        return Err(ParseError::UnsupportedVersion(version));
    }
    // Capture files older than 1.17.2 have no `leyline` key, but always
    // have `gi_player`.
    if value.get("leyline").is_none() && value.get("gi_player").is_none() {
        return Err(ParseError::NotLeyline);
    }
    let content_hash = canonical::hash(&value);
    // Parsed again from the bytes, not from `value`, so errors keep their
    // line and column.
    let data: Good = serde_json::from_slice(bytes).map_err(ParseError::Json)?;
    Ok(Export {
        data,
        content_hash,
        value,
    })
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub characters: u32,
    pub weapons: u32,
    pub artifacts: u32,
    /// Artifacts of 4 and 3 stars. These and `essence` are `None` for a
    /// snapshot whose export was already dropped when the app began counting
    /// them.
    pub artifacts4: Option<u32>,
    pub artifacts3: Option<u32>,
    /// Material kinds with a non-zero count.
    pub materials: u32,
    /// `None` when the file lists no materials at all.
    pub mora: Option<u64>,
    pub primogems: Option<u64>,
    /// Sanctifying Essence, under the same rule as Mora.
    pub essence: Option<u64>,
}

/// The distinct keys of an export, sorted, for checking against the names
/// the app knows.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Keys {
    pub characters: Vec<String>,
    pub weapons: Vec<String>,
    pub artifact_sets: Vec<String>,
    pub materials: Vec<String>,
}

impl Export {
    /// The save time in unix milliseconds, if the file has one.
    pub fn taken_at(&self) -> Option<i64> {
        self.data.timestamp
    }

    pub fn uid(&self) -> Option<u64> {
        self.data.player.as_ref().and_then(|player| player.uid)
    }

    pub fn summary(&self) -> Summary {
        let data = &self.data;
        // Leyline leaves out zero counts, so a missing currency is 0 once the
        // file has any materials.
        let zero_if_missing = !data.materials.is_empty();
        let currency = |key: &str| match data.materials.get(key) {
            Some(&n) => Some(n),
            None => zero_if_missing.then_some(0),
        };
        let rarity = |stars| count(data.artifacts.iter().filter(|a| a.rarity == stars).count());
        Summary {
            characters: count(data.characters.len()),
            weapons: count(data.weapons.len()),
            artifacts: count(data.artifacts.len()),
            artifacts4: Some(rarity(4)),
            artifacts3: Some(rarity(3)),
            materials: count(data.materials.values().filter(|&&n| n > 0).count()),
            mora: currency("Mora"),
            primogems: currency("Primogem"),
            essence: currency("SanctifyingEssence"),
        }
    }

    pub fn keys(&self) -> Keys {
        fn distinct<'a>(keys: impl Iterator<Item = &'a String>) -> Vec<String> {
            keys.collect::<BTreeSet<_>>().into_iter().cloned().collect()
        }
        let data = &self.data;
        Keys {
            characters: distinct(data.characters.iter().map(|c| &c.key)),
            weapons: distinct(data.weapons.iter().map(|w| &w.key)),
            artifact_sets: distinct(data.artifacts.iter().map(|a| &a.set_key)),
            materials: distinct(
                data.materials
                    .iter()
                    .filter(|(_, n)| **n > 0)
                    .map(|(key, _)| key),
            ),
        }
    }
}

fn count(len: usize) -> u32 {
    u32::try_from(len).unwrap_or(u32::MAX)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Category {
    Characters,
    Weapons,
    Artifacts,
}

/// Why a new export should be confirmed before it is saved.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Warning {
    Fewer {
        what: Category,
        before: u32,
        after: u32,
    },
    /// A file of an account no snapshot is of yet, while there are others.
    /// Only the database can tell: `warnings` never gives it.
    NewAccount,
}

/// Compares a new export with its account's snapshot before it. Characters
/// never go away in the game, so any loss is suspect; weapons and artifacts
/// are eaten as fodder, so only a loss of more than a fifth is. A misread
/// export tends to lose most of one kind.
pub fn warnings(previous: &Summary, next: &Summary) -> Vec<Warning> {
    let mut warnings = Vec::new();
    let fewer = |what, before: u32, after: u32| Warning::Fewer {
        what,
        before,
        after,
    };
    if next.characters < previous.characters {
        warnings.push(fewer(
            Category::Characters,
            previous.characters,
            next.characters,
        ));
    }
    for (what, before, after) in [
        (Category::Weapons, previous.weapons, next.weapons),
        (Category::Artifacts, previous.artifacts, next.artifacts),
    ] {
        if u64::from(after) * 5 < u64::from(before) * 4 {
            warnings.push(fewer(what, before, after));
        }
    }
    warnings
}

#[cfg(test)]
mod tests;
