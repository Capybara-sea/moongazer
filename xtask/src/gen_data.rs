// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! `cargo xtask gen-data [--update]`: writes the game name table
//! `apps/desktop/src/generated/names.json` from the upstream commits pinned in
//! `tools/datagen/sources.json`. `--update` moves the pins to the latest
//! commits first.

use std::path::Path;
use std::process::Command;

use anyhow::Result;

use crate::util;

pub fn run(root: &Path, update: bool) -> Result<()> {
    util::run(&mut command(root, update))
}

pub fn command(root: &Path, update: bool) -> Command {
    let mut node = util::node_tool("node", root);
    node.arg("tools/datagen/src/main.ts");
    if update {
        node.arg("--update");
    }
    node
}
