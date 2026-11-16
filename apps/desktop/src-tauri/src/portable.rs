// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Portable mode: a `portable` file next to the executable keeps every app
//! directory, the webview data included, in `app-data` beside it.

use std::path::{Path, PathBuf};

use tauri::utils::config::AppDirectoriesOverride;

pub const MARKER: &str = "portable";
pub const DATA_DIR: &str = "app-data";

/// Whether this run is the portable build.
pub struct Mode(pub bool);

/// The executable's directory, when the marker file sits next to it.
pub fn detect() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    dir.join(MARKER).is_file().then(|| dir.to_path_buf())
}

/// Must run before the app is built: Tauri resolves its directories once.
pub fn apply<R: tauri::Runtime>(context: &mut tauri::Context<R>, exe_dir: &Path) {
    context.config_mut().app.app_directories_override =
        Some(AppDirectoriesOverride::Root(exe_dir.join(DATA_DIR)));
}
