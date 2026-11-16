// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Portable mode: a `portable` file next to the executable keeps every app
//! directory, the webview data included, in `app-data` beside it.
//!
//! The portable build updates itself by swapping its executable: Windows lets
//! a running program be renamed, but not overwritten or deleted.

use std::borrow::Cow;
use std::fs;
use std::io::{Cursor, copy};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use anyhow::{Context, Result};
use tauri::utils::config::AppDirectoriesOverride;

pub const MARKER: &str = "portable";
pub const DATA_DIR: &str = "app-data";

pub struct Mode {
    pub portable: bool,
    /// The portable build can replace its own executable: its folder is
    /// writable. Without that it only points to the download page.
    pub replaceable: bool,
}

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

pub fn writable(dir: &Path) -> bool {
    let probe = dir.join(".moongazer-write-test");
    let ok = fs::write(&probe, b"").is_ok();
    // A leftover empty file does no harm.
    let _ = fs::remove_file(&probe);
    ok
}

fn old_path(exe: &Path) -> PathBuf {
    exe.with_extension("exe.old")
}

/// Deletes the executable an update moved aside. It stays locked until the
/// old process has exited, which may be a moment after this one started.
pub fn remove_old_exe() {
    let Ok(exe) = std::env::current_exe() else {
        return;
    };
    let old = old_path(&exe);
    if !old.exists() {
        return;
    }
    thread::spawn(move || {
        for _ in 0..30 {
            if fs::remove_file(&old).is_ok() || !old.exists() {
                return;
            }
            thread::sleep(Duration::from_secs(1));
        }
        tracing::warn!("the previous executable could not be deleted");
    });
}

/// Puts the program in `package`, the portable zip, in place of `exe`; the
/// running file moves to `<exe>.old`. On failure `exe` is left as it was.
pub fn replace_exe(exe: &Path, package: &[u8]) -> Result<()> {
    let new = exe.with_extension("exe.new");
    let old = old_path(exe);
    if let Err(err) = extract_exe(package, &new) {
        let _ = fs::remove_file(&new);
        return Err(err.context("unpacking the update"));
    }
    // From an earlier update, if its cleanup never ran.
    let _ = fs::remove_file(&old);
    if let Err(err) = fs::rename(exe, &old) {
        let _ = fs::remove_file(&new);
        return Err(err).context("moving the running program aside");
    }
    if let Err(err) = fs::rename(&new, exe) {
        let _ = fs::rename(&old, exe);
        let _ = fs::remove_file(&new);
        return Err(err).context("moving the update into place");
    }
    Ok(())
}

/// The package holds one program, `Moongazer/Moongazer.exe`, and the marker.
fn extract_exe(package: &[u8], to: &Path) -> Result<()> {
    let mut archive = zip::ZipArchive::new(Cursor::new(package))?;
    let name = archive
        .file_names()
        .filter_map(Result::ok)
        .find(|name| name.to_ascii_lowercase().ends_with(".exe"))
        .map(Cow::into_owned)
        .context("the package holds no program")?;
    let mut entry = archive.by_name(&name)?;
    let mut file = fs::File::create(to)?;
    copy(&mut entry, &mut file)?;
    file.sync_all()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use zip::write::{SimpleFileOptions, ZipWriter};

    use super::*;

    fn package(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
        for (name, bytes) in entries {
            zip.start_file(*name, SimpleFileOptions::default()).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap().into_inner()
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("moongazer-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn the_program_is_swapped_and_the_old_one_kept_aside() {
        let dir = temp_dir("swap");
        let exe = dir.join("Moongazer.exe");
        fs::write(&exe, b"old").unwrap();
        let zip = package(&[
            ("Moongazer/portable", b"marker"),
            ("Moongazer/Moongazer.exe", b"new"),
        ]);
        replace_exe(&exe, &zip).unwrap();
        assert_eq!(fs::read(&exe).unwrap(), b"new");
        assert_eq!(fs::read(dir.join("Moongazer.exe.old")).unwrap(), b"old");
        assert!(!dir.join("Moongazer.exe.new").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_package_without_a_program_changes_nothing() {
        let dir = temp_dir("no-program");
        let exe = dir.join("Moongazer.exe");
        fs::write(&exe, b"old").unwrap();
        assert!(replace_exe(&exe, &package(&[("Moongazer/portable", b"marker")])).is_err());
        assert!(replace_exe(&exe, b"not a zip").is_err());
        assert_eq!(fs::read(&exe).unwrap(), b"old");
        assert!(!dir.join("Moongazer.exe.old").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_folder_that_exists_is_writable() {
        let dir = temp_dir("writable");
        assert!(writable(&dir));
        assert!(!writable(&dir.join("missing")));
        fs::remove_dir_all(dir).unwrap();
    }
}
