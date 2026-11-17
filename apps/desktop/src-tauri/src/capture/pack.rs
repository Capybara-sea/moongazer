// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The capture pack: the files decoding needs besides the linked crates,
//! written by `cargo xtask pack` and never committed.
//!
//! - `gi.json`: the dispatch keys, base64 by key id.
//! - `game_data.gz`: the game database, gzipped JSON.
//! - `pack.json`: the upstream source the keys came from, and the id of the
//!   data set the database was built from.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::BufReader;
use std::path::Path;

use anyhow::{Context, Result, bail};
use base64::Engine as _;
use base64::prelude::BASE64_STANDARD;
use flate2::read::GzDecoder;
use serde::Deserialize;
use teyvatme_game_data::AnimeGameData;

/// The upstream source this build is linked against (see build.rs).
const UPSTREAM: &str = env!("CAPTURE_UPSTREAM");

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
}

impl Pack {
    /// Loads the pack in `dir`. A pack from another upstream version is
    /// refused: the database is read without a version check, so its tables
    /// would be trusted as they are.
    pub fn load(dir: &Path) -> Result<Self> {
        let manifest: Manifest = read_json(&dir.join("pack.json"))?;
        if manifest.upstream != UPSTREAM {
            bail!(
                "the capture pack was built from {}, but this build links {UPSTREAM}; \
                 run `cargo xtask pack`",
                manifest.upstream
            );
        }

        let encoded: HashMap<u16, String> = read_json(&dir.join("gi.json"))?;
        let keys = encoded
            .into_iter()
            .map(|(id, key)| Ok((id, BASE64_STANDARD.decode(key)?)))
            .collect::<Result<_>>()
            .context("decoding the dispatch keys")?;

        let path = dir.join("game_data.gz");
        let file = File::open(&path).with_context(|| format!("opening {}", path.display()))?;
        let game_data = AnimeGameData::new_from_reader(BufReader::new(GzDecoder::new(file)))
            .with_context(|| format!("reading {}", path.display()))?;
        // A file holding JSON `null` reads as a database with nothing in it.
        if !game_data.has_data() {
            bail!("{} holds no game data", path.display());
        }

        Ok(Self {
            keys,
            game_data,
            data_id: manifest.data_id,
        })
    }
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let text = fs::read_to_string(path).with_context(|| format!("reading {}", path.display()))?;
    // Not serde's own message for a parse error: it can quote the file, and
    // one of these files holds keys.
    serde_json::from_str(&text).map_err(|err| {
        anyhow::anyhow!(
            "{} is not valid (line {}, column {})",
            path.display(),
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

    /// A pack directory with fake keys and whatever `game_data` holds.
    fn write_pack(name: &str, upstream: &str, game_data: &str) -> std::path::PathBuf {
        let dir =
            std::env::temp_dir().join(format!("moongazer-pack-{name}-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("pack.json"),
            format!(
                r#"{{"upstream":"{upstream}","dataId":"{}"}}"#,
                "0".repeat(40)
            ),
        )
        .unwrap();
        fs::write(dir.join("gi.json"), r#"{"1":"AAEC","2":"AwQF"}"#).unwrap();
        let mut gz = GzEncoder::new(Vec::new(), Compression::fast());
        gz.write_all(game_data.as_bytes()).unwrap();
        fs::write(dir.join("game_data.gz"), gz.finish().unwrap()).unwrap();
        dir
    }

    fn load_error(dir: &Path) -> String {
        let error = Pack::load(dir).err().expect("the pack is refused");
        fs::remove_dir_all(dir).unwrap();
        format!("{error:#}")
    }

    #[test]
    fn a_pack_from_another_upstream_version_is_refused() {
        let dir = write_pack(
            "version",
            "git+https://example.invalid/other?tag=v0#0",
            "null",
        );
        assert!(load_error(&dir).contains("cargo xtask pack"));
    }

    #[test]
    fn a_pack_without_game_data_is_refused() {
        let dir = write_pack("empty", UPSTREAM, "null");
        assert!(load_error(&dir).contains("holds no game data"));
    }

    #[test]
    fn a_missing_pack_says_which_file_is_missing() {
        let dir = std::env::temp_dir().join("moongazer-pack-missing");
        let error = format!("{:#}", Pack::load(&dir).err().expect("nothing to load"));
        assert!(error.contains("pack.json"));
    }
}
