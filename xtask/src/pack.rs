// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! `cargo xtask pack`: the capture pack, in the git-ignored
//! `apps/desktop/src-tauri/capture-pack/`:
//!
//! - `gi.json`: upstream's dispatch keys, as they are in Cargo's checkout of
//!   the upstream tag the app links.
//! - `game_data.gz`: the game database, built with upstream's own crate from
//!   AnimeGameData's tables at the commit pinned in
//!   `tools/datagen/sources.json`, so a new game version does not wait for an
//!   upstream release.
//! - `commission-cities.json` and `commission-rewards.json`: the city of every
//!   daily commission and Katheryne's reward for them by Adventure Rank, from
//!   the same data set, which upstream's crate has no tables for.
//! - `pack.json`: the upstream source, the data set's id (that commit) and
//!   the SHA-256 of the keys. The database is written from hash maps and
//!   differs byte for byte on every run, so it has no checksum of its own.
//!
//! No cargo command runs inside the checkout: its rust-toolchain.toml asks
//! for a nightly toolchain.

use std::fs::{self, File};
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::pin;
use std::task::{Context as Task, Poll, Waker};

use anyhow::{Context, Result, bail};
use flate2::Compression;
use flate2::write::GzEncoder;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use teyvatme_game_data::{AnimeGameData, Pinned};

use crate::util;

const OUT: &str = "apps/desktop/src-tauri/capture-pack";
/// Where the tables are laid out for upstream's crate, next to the data
/// generator's downloads.
const TABLES: &str = "tools/datagen/.cache/capture-tables";
/// Tables the database builder leaves empty without an error: any of them
/// when AnimeGameData has obfuscated the name of a field it is read by, and
/// the last five also when their files cannot be read.
const CHECKED_TABLES: [&str; 15] = [
    "affix_map",
    "artifact_map",
    "character_map",
    "material_map",
    "property_map",
    "set_map",
    "skill_element_map",
    "skill_type_map",
    "weapon_map",
    "spincrystals",
    "recipes",
    "crafting",
    "id_tables",
    "exploration",
    "endgame",
];
/// The fewest entries the tables keyed by id may have, about half of what
/// the game had in 7.2. When the obfuscated field is the id, every row lands
/// under one key: the table is not empty, only far too small. The skill types
/// come from two fields, and two thirds of them (282 of 424) are left without
/// `energySkill`, so their minimum is above that.
const MINIMUM: [(&str, usize); 11] = [
    ("affix_map", 150),
    ("artifact_map", 2000),
    ("character_map", 80),
    ("material_map", 5000),
    ("property_map", 30),
    ("set_map", 30),
    ("skill_element_map", 80),
    ("skill_type_map", 350),
    ("weapon_map", 130),
    ("spincrystals", 100),
    ("recipes", 140),
];

pub fn run(root: &Path) -> Result<()> {
    let (upstream, checkout) = upstream(root)?;
    let keys = fs::read(checkout.join("apps/desktop/keys/gi.json"))
        .context("reading upstream's dispatch keys")?;
    // Upstream's own pinned tables only say which files to fetch.
    let tables = root.join(TABLES);
    // `dist` runs this with the signing key in its environment; the
    // download script must not see it.
    util::run(
        util::without_key(&mut util::node_tool("node", root))
            .arg("tools/datagen/src/captureTables.ts")
            .arg(checkout.join("game-data/manifest.json"))
            .arg(&tables),
    )?;

    let pinned = Pinned::open(&tables)?;
    let mut database = AnimeGameData::new();
    {
        // Reading pinned files never waits, so the future is done at its
        // first poll and needs no runtime.
        let build = pin!(database.update_from(&pinned));
        match build.poll(&mut Task::from_waker(Waker::noop())) {
            Poll::Ready(built) => built.context("building the game database")?,
            Poll::Pending => bail!("building the game database did not finish at once"),
        }
    }
    let mut json = Vec::new();
    database.save_to_writer(&mut json)?;
    let built: Value = serde_json::from_slice(&json)?;
    let mut missing = empty_tables(&built);
    missing.extend(short_tables(&built));
    if !missing.is_empty() {
        bail!("the game database is missing {}", missing.join(", "));
    }

    let out = root.join(OUT);
    fs::create_dir_all(&out).with_context(|| format!("creating {}", out.display()))?;
    let mut gz = GzEncoder::new(File::create(out.join("game_data.gz"))?, Compression::best());
    std::io::Write::write_all(&mut gz, &json)?;
    gz.finish()?;
    fs::write(out.join("gi.json"), &keys)?;
    for file in ["commission-cities.json", "commission-rewards.json"] {
        fs::copy(tables.join(file), out.join(file))?;
    }
    let pack = json!({
        "upstream": upstream,
        "dataId": pinned.id(),
        "sha256": { "gi.json": sha256(&keys) },
    });
    fs::write(
        out.join("pack.json"),
        serde_json::to_string_pretty(&pack)? + "\n",
    )?;
    println!("pack: {} (game data set {})", out.display(), pinned.id());
    Ok(())
}

/// The upstream source as Cargo.lock names it (the app's build script reads
/// the same string) and the root of Cargo's checkout of it.
fn upstream(root: &Path) -> Result<(String, PathBuf)> {
    let metadata = util::output(util::without_key(&mut util::cargo(root)).args([
        "metadata",
        "--locked",
        "--all-features",
        "--format-version",
        "1",
    ]))?;
    let metadata: Value = serde_json::from_str(&metadata).context("parsing cargo metadata")?;
    let core = metadata["packages"]
        .as_array()
        .into_iter()
        .flatten()
        .find(|package| package["name"] == "teyvatme-core")
        .context("teyvatme-core is not among the dependencies")?;
    let (Some(source), Some(manifest)) = (core["source"].as_str(), core["manifest_path"].as_str())
    else {
        bail!("cargo metadata has no source or path for teyvatme-core");
    };
    // <checkout>/crates/core/Cargo.toml
    let checkout = Path::new(manifest)
        .ancestors()
        .nth(3)
        .context("unexpected path to teyvatme-core")?;
    Ok((source.to_owned(), checkout.to_owned()))
}

/// The checked tables, or the parts of them, that came out empty.
fn empty_tables(database: &Value) -> Vec<String> {
    let is_empty = |value: &Value| match value {
        Value::Object(fields) => fields.is_empty(),
        Value::Array(items) => items.is_empty(),
        _ => false,
    };
    let mut empty = Vec::new();
    for table in CHECKED_TABLES {
        let value = &database[table];
        if value.is_null() || is_empty(value) {
            empty.push(table.to_owned());
        } else if let Value::Object(parts) = value {
            empty.extend(
                parts
                    .iter()
                    .filter(|(_, part)| is_empty(part))
                    .map(|(name, _)| format!("{table}.{name}")),
            );
        }
    }
    empty
}

/// The tables that have entries, but fewer than their minimum.
fn short_tables(database: &Value) -> Vec<String> {
    MINIMUM
        .iter()
        .filter_map(|&(table, least)| {
            let entries = database[table].as_object().map_or(0, serde_json::Map::len);
            (0 < entries && entries < least)
                .then(|| format!("{table} ({entries} of at least {least})"))
        })
        .collect()
}

fn sha256(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nothing_above_info_is_compiled_into_the_upstream_crate() {
        use tracing::level_filters::{LevelFilter, STATIC_MAX_LEVEL};
        assert!(STATIC_MAX_LEVEL <= LevelFilter::INFO);
        assert!(log::STATIC_MAX_LEVEL <= log::LevelFilter::Info);
    }

    #[test]
    fn tables_left_empty_are_named() {
        let mut database = json!({});
        for table in CHECKED_TABLES {
            database[table] = json!({ "1": 2 });
        }
        database["weapon_map"] = json!({});
        database["crafting"] = json!({ "combine": [1], "forge": [] });
        database["exploration"] = json!({ "cities": [1], "scene_points": {} });
        database["endgame"] = Value::Null;
        assert_eq!(
            empty_tables(&database),
            [
                "weapon_map",
                "crafting.forge",
                "exploration.scene_points",
                "endgame"
            ]
        );
    }

    #[test]
    fn tables_far_smaller_than_the_game_are_named() {
        let mut database = json!({});
        for (table, least) in MINIMUM {
            let entries: serde_json::Map<String, Value> =
                (0..least).map(|id| (id.to_string(), json!(1))).collect();
            database[table] = entries.into();
        }
        database["weapon_map"] = json!({ "0": 1 });
        database["recipes"] = json!({});
        assert_eq!(short_tables(&database), ["weapon_map (1 of at least 130)"]);
    }
}
