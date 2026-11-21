// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The capture pack: the files decoding needs besides the linked crates,
//! written by `cargo xtask pack`, never committed, and built into the exe
//! (build.rs sets `capture_pack` when they are there).
//!
//! - `gi.json`: the dispatch keys, base64 by key id.
//! - `game_data.gz`: the game database, gzipped JSON.
//! - `commission-cities.json`: the city of every daily commission, by id.
//! - `pack.json`: the upstream source the keys came from, and the id of the
//!   data set the database was built from.

use std::collections::HashMap;
use std::io::BufReader;

use anyhow::{Context, Result, bail};
use base64::Engine as _;
use base64::prelude::BASE64_STANDARD;
use flate2::read::GzDecoder;
use serde::Deserialize;
use teyvatme_game_data::AnimeGameData;

/// The upstream source this build is linked against (see build.rs).
const UPSTREAM: &str = env!("CAPTURE_UPSTREAM");

/// The four files' contents.
pub struct Files<'a> {
    pub manifest: &'a [u8],
    pub keys: &'a [u8],
    pub game_data: &'a [u8],
    pub commission_cities: &'a [u8],
}

#[cfg(capture_pack)]
const BUILT_IN: Option<Files<'static>> = Some(Files {
    manifest: include_bytes!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/capture-pack/pack.json"
    )),
    keys: include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/capture-pack/gi.json")),
    game_data: include_bytes!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/capture-pack/game_data.gz"
    )),
    commission_cities: include_bytes!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/capture-pack/commission-cities.json"
    )),
});
#[cfg(not(capture_pack))]
const BUILT_IN: Option<Files<'static>> = None;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    upstream: String,
    data_id: String,
}

pub struct Pack {
    pub(super) keys: HashMap<u16, Vec<u8>>,
    pub(super) game_data: AnimeGameData,
    /// Names the data set in the export (`gi_player.gameData`).
    pub(super) data_id: String,
    pub(super) commission_cities: HashMap<u32, u32>,
}

impl Pack {
    /// The pack built into the exe.
    pub fn built_in() -> Result<Self> {
        let files = BUILT_IN
            .as_ref()
            .context("this build has no capture pack; run `cargo xtask pack` and build again")?;
        Self::read(files)
    }

    /// A pack from another upstream version is refused: the database is read
    /// without a version check, so its tables would be trusted as they are.
    pub fn read(files: &Files) -> Result<Self> {
        let manifest: Manifest = parse_json("pack.json", files.manifest)?;
        if manifest.upstream != UPSTREAM {
            bail!(
                "the capture pack was built from {}, but this build links {UPSTREAM}; \
                 run `cargo xtask pack`",
                manifest.upstream
            );
        }

        let encoded: HashMap<u16, String> = parse_json("gi.json", files.keys)?;
        let keys = encoded
            .into_iter()
            .map(|(id, key)| Ok((id, BASE64_STANDARD.decode(key)?)))
            .collect::<Result<_>>()
            .context("decoding the dispatch keys")?;

        let game_data =
            AnimeGameData::new_from_reader(BufReader::new(GzDecoder::new(files.game_data)))
                .context("reading game_data.gz")?;
        // A file holding JSON `null` reads as a database with nothing in it.
        if !game_data.has_data() {
            bail!("game_data.gz holds no game data");
        }

        Ok(Self {
            keys,
            game_data,
            data_id: manifest.data_id,
            commission_cities: parse_json("commission-cities.json", files.commission_cities)?,
        })
    }
}

fn parse_json<T: serde::de::DeserializeOwned>(name: &str, bytes: &[u8]) -> Result<T> {
    // Not serde's own message for a parse error: it can quote the file, and
    // one of these files holds keys.
    serde_json::from_slice(bytes).map_err(|err| {
        anyhow::anyhow!(
            "{name} is not valid (line {}, column {})",
            err.line(),
            err.column()
        )
    })
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use flate2::Compression;
    use flate2::write::GzEncoder;

    use super::*;

    /// Reads a pack with fake keys and whatever `game_data` holds.
    fn read_error(manifest: &str, keys: &str, game_data: &str) -> String {
        let mut gz = GzEncoder::new(Vec::new(), Compression::fast());
        gz.write_all(game_data.as_bytes()).unwrap();
        let game_data = gz.finish().unwrap();
        let files = Files {
            manifest: manifest.as_bytes(),
            keys: keys.as_bytes(),
            game_data: &game_data,
            commission_cities: b"{}",
        };
        format!(
            "{:#}",
            Pack::read(&files).err().expect("the pack is refused")
        )
    }

    fn manifest(upstream: &str) -> String {
        format!(
            r#"{{"upstream":"{upstream}","dataId":"{}"}}"#,
            "0".repeat(40)
        )
    }

    const KEYS: &str = r#"{"1":"AAEC","2":"AwQF"}"#;

    #[test]
    fn a_pack_from_another_upstream_version_is_refused() {
        let error = read_error(
            &manifest("git+https://example.invalid/other?tag=v0#0"),
            KEYS,
            "null",
        );
        assert!(error.contains("cargo xtask pack"));
    }

    #[test]
    fn a_pack_without_game_data_is_refused() {
        let error = read_error(&manifest(UPSTREAM), KEYS, "null");
        assert!(error.contains("holds no game data"));
    }

    #[test]
    fn a_broken_file_is_named_but_not_quoted() {
        let error = read_error(&manifest(UPSTREAM), r#"{"1":"SECRETKEY""#, "null");
        assert!(error.contains("gi.json is not valid"));
        assert!(!error.contains("SECRETKEY"));
    }
}
