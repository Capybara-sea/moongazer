// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! `cargo xtask gen-data [--update]`: writes the game data tables in
//! `apps/desktop/src/generated/` from the upstream commits pinned in
//! `tools/datagen/sources.json`, and the third-party notices next to them.
//! `--update` moves the pins to the latest commits first.

use std::path::Path;
use std::process::Command;

use anyhow::Result;

use crate::{notices, util};

pub fn run(root: &Path, update: bool) -> Result<()> {
    util::run(&mut command(root, update))?;
    // The About page imports it. Dev, check and CI get the build with auto
    // sync; `dist` writes the one for the build it makes.
    notices::write_app_json(root, true)
}

pub fn command(root: &Path, update: bool) -> Command {
    let mut node = util::node_tool("node", root);
    node.arg("tools/datagen/src/main.ts");
    if update {
        node.arg("--update");
    }
    node
}
