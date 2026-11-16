// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Installing a missing WebView2 runtime. The installer handles this itself,
//! but the portable build can land on an older Windows 10 without it.
//!
//! The check runs before Tauri starts, so the user sees one question instead
//! of Tauri's own English error. On yes, Microsoft's bootstrapper is
//! downloaded with the curl.exe that ships with Windows 10 1803 and later,
//! run, and the app restarts itself. Any failure falls back to a dialog with
//! the download link.

use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result, ensure};

use crate::{text, win};

/// Microsoft's permanent link to the Evergreen bootstrapper.
const BOOTSTRAPPER_URL: &str = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
/// Keeps curl.exe from flashing a console window.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// False when the app has to quit: the runtime is missing, and either the user
/// declined, the install failed, or it succeeded and a fresh instance started.
pub fn check() -> bool {
    if tauri::webview_version().is_ok() {
        return true;
    }
    if win::ask(text::APP_NAME, text::WEBVIEW2_ASK) && install_and_restart().is_err() {
        win::error_box(text::APP_NAME, text::WEBVIEW2_MANUAL);
    }
    false
}

fn install_and_restart() -> Result<()> {
    let setup = std::env::temp_dir().join("MicrosoftEdgeWebview2Setup.exe");
    let installed = download_and_run(&setup);
    // Best effort: a leftover installer in %TEMP% is harmless.
    let _ = std::fs::remove_file(&setup);
    installed?;
    Command::new(std::env::current_exe()?).spawn()?;
    Ok(())
}

fn download_and_run(setup: &Path) -> Result<()> {
    let system_root = std::env::var_os("SystemRoot").context("SystemRoot is not set")?;
    let curl = PathBuf::from(system_root).join("System32").join("curl.exe");
    // No window is open yet, so a stalled download must not hang silently.
    let status = Command::new(curl)
        .args([
            "--fail",
            "--silent",
            "--show-error",
            "--location",
            "--proto",
            "=https",
            "--connect-timeout",
            "15",
            "--max-time",
            "300",
        ])
        .arg("--output")
        .arg(setup)
        .arg(BOOTSTRAPPER_URL)
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .context("running curl.exe")?;
    ensure!(
        status.success(),
        "downloading the bootstrapper failed ({status})"
    );
    let status = Command::new(setup)
        .status()
        .context("running the bootstrapper")?;
    ensure!(status.success(), "the bootstrapper failed ({status})");
    Ok(())
}
