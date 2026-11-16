// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! `cargo xtask icons <source>`: regenerates the app icons from the logo and
//! drops the sizes a Windows-only app does not use (Android, iOS, macOS and
//! Microsoft Store icons).

use std::fs;
use std::path::Path;

use anyhow::{Context, Result};

use crate::util;

const ICON_DIR: &str = "apps/desktop/src-tauri/icons";
/// Referenced by tauri.conf.json (bundle.icon) or used as the window icon.
const KEEP: [&str; 5] = [
    "32x32.png",
    "128x128.png",
    "128x128@2x.png",
    "icon.ico",
    "icon.png",
];

pub fn run(root: &Path, source: &str) -> Result<()> {
    let source = fs::canonicalize(source).with_context(|| format!("finding {source}"))?;
    util::run(
        util::node_tool("pnpm", root)
            .args(["--filter", "@moongazer/desktop", "tauri", "icon"])
            .arg(&source),
    )?;
    let dir = root.join(ICON_DIR);
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if KEEP.contains(&name.as_str()) {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            fs::remove_dir_all(&path)?;
        } else {
            fs::remove_file(&path)?;
        }
    }
    println!(
        "icons: regenerated {} from {}",
        dir.display(),
        source.display()
    );
    Ok(())
}
