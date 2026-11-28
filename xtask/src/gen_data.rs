// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! `cargo xtask gen-data [--update]`: writes the game data tables in
//! `apps/desktop/src/generated/` from the upstream commits pinned in
//! `tools/datagen/sources.json`, the UI font's faces from Sarasa Gothic's
//! release (`tools/datagen/src/font.ts`), and the third-party notices next to
//! them.
//! `--update` moves the pins to the latest commits first.

use std::path::Path;
use std::process::Command;

use anyhow::Result;

use crate::{notices, util};

pub fn run(root: &Path, update: bool) -> Result<()> {
    util::run(&mut command(root, update))?;
    util::run(&mut font_command(root))?;
    // The About page imports it.
    notices::write_app_json(root)
}

pub fn command(root: &Path, update: bool) -> Command {
    let mut node = util::node_tool("node", root);
    node.arg("tools/datagen/src/main.ts");
    if update {
        node.arg("--update");
    }
    node
}

/// Writes the UI font's faces; apart from `command`, which the AGD watch in CI
/// runs on its own and which has no use for the font.
pub fn font_command(root: &Path) -> Command {
    let mut node = util::node_tool("node", root);
    node.arg("tools/datagen/src/font.ts");
    node
}
