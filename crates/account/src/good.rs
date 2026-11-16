// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The GOOD v1–3 file shape, plus the Leyline keys the app reads.
//!
//! Fields that GOOD v3 added, and everything Leyline adds, are optional: other
//! exporters omit them and Capture leaves out whatever it did not see.

use std::collections::BTreeMap;

use serde::{Deserialize, Deserializer};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Good {
    #[serde(default)]
    pub source: String,
    /// Leyline only: when the export was saved, in unix milliseconds.
    pub timestamp: Option<i64>,
    /// Leyline only, from Capture 1.17.2 on.
    pub leyline: Option<u32>,
    #[serde(default)]
    pub characters: Vec<Character>,
    #[serde(default)]
    pub weapons: Vec<Weapon>,
    #[serde(default)]
    pub artifacts: Vec<Artifact>,
    #[serde(default)]
    pub materials: BTreeMap<String, u64>,
    #[serde(rename = "gi_player")]
    pub player: Option<Player>,
}

#[derive(Debug, Deserialize)]
pub struct Character {
    pub key: String,
    pub level: u32,
    pub ascension: u32,
    pub constellation: u32,
    /// Base levels, without the +3 from constellations.
    pub talent: Talent,
}

#[derive(Debug, Deserialize)]
pub struct Talent {
    pub auto: u32,
    pub skill: u32,
    pub burst: u32,
}

#[derive(Debug, Deserialize)]
pub struct Weapon {
    pub key: String,
    pub level: u32,
    pub ascension: u32,
    pub refinement: u32,
    /// The wielder's key, `"Traveler"` for any Traveler, `""` when unequipped.
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub lock: bool,
    #[serde(rename = "gi_guid")]
    pub guid: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Artifact {
    pub set_key: String,
    pub slot_key: String,
    pub level: u32,
    pub rarity: u32,
    pub main_stat_key: String,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub lock: bool,
    #[serde(default)]
    pub substats: Vec<Substat>,
    pub total_rolls: Option<u32>,
    #[serde(default)]
    pub astral_mark: bool,
    /// Capture before 1.17.18 spelled it `elixerCrafted`.
    #[serde(default, alias = "elixerCrafted")]
    pub elixir_crafted: bool,
    #[serde(default)]
    pub unactivated_substats: Vec<Substat>,
    #[serde(rename = "gi_guid")]
    pub guid: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Substat {
    pub key: String,
    pub value: f64,
    pub initial_value: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct Player {
    /// Anything but a number counts as missing, so a malformed UID is never
    /// quoted in a parse error, which the UI shows.
    #[serde(default, deserialize_with = "lenient_u64")]
    pub uid: Option<u64>,
}

fn lenient_u64<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<u64>, D::Error> {
    Ok(serde_json::Value::deserialize(deserializer)?.as_u64())
}
