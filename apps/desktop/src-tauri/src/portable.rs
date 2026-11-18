// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Portable mode: a `portable` file next to the executable keeps every app
//! directory, the webview data included, in `app-data` beside it.
//!
//! The portable build updates itself by swapping its executable: Windows lets
//! a running program be renamed, but not overwritten or deleted. The capture
//! pack next to it is replaced along with it: a pack is refused by a program
//! built against another upstream version.

use std::borrow::Cow;
use std::fs;
use std::io::{Cursor, copy};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use anyhow::{Context, Result};
use tauri::utils::config::AppDirectoriesOverride;

pub const MARKER: &str = "portable";
/// The capture pack's folder next to the executable.
const PACK_DIR: &str = "capture-pack";
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

/// Puts the program in `package`, the portable zip, in place of `exe`, and
/// its capture pack, if any, in place of the one beside it; the running file
/// moves to `<exe>.old`. On failure both are put back as they were. Auto
/// sync must be stopped first: its capture mode runs this executable.
pub fn replace_exe(exe: &Path, package: &[u8]) -> Result<()> {
    let new = exe.with_extension("exe.new");
    let old = old_path(exe);
    let pack_dir = exe.parent().map(|dir| dir.join(PACK_DIR));
    let pack = match &pack_dir {
        Some(dir) => unpack_pack(package, dir),
        None => Ok(Vec::new()),
    };
    let unpacked = pack.and_then(|pack| extract_exe(package, &new).map(|()| pack));
    let pack = match unpacked {
        Ok(pack) => pack,
        Err(err) => {
            let _ = fs::remove_file(&new);
            if let Some(dir) = &pack_dir {
                remove_unpacked(dir);
            }
            return Err(err.context("unpacking the update"));
        }
    };
    let cleanup = |pack: &[(PathBuf, PathBuf)]| {
        let _ = fs::remove_file(&new);
        for (unpacked, _) in pack {
            let _ = fs::remove_file(unpacked);
        }
    };
    // From an earlier update, if its cleanup never ran.
    let _ = fs::remove_file(&old);
    if let Err(err) = fs::rename(exe, &old) {
        cleanup(&pack);
        return Err(err).context("moving the running program aside");
    }
    if let Err(err) = fs::rename(&new, exe) {
        let _ = fs::rename(&old, exe);
        cleanup(&pack);
        return Err(err).context("moving the update into place");
    }
    // The pack last, so a program that could not be swapped keeps the pack
    // it was built for.
    if let Err(err) = place_pack(&pack) {
        // The update is not running, so it can be replaced.
        let _ = fs::rename(&old, exe);
        return Err(err).context("moving the capture pack into place");
    }
    Ok(())
}

/// Moves the unpacked files over their targets, each target set aside as
/// `<file>.old` until all are in. On failure the targets are put back: a
/// pack half new and half old could be read without an error.
fn place_pack(pack: &[(PathBuf, PathBuf)]) -> std::io::Result<()> {
    // Each target touched, with where its earlier file went.
    let mut moved = Vec::new();
    let mut result = Ok(());
    for (unpacked, target) in pack {
        let aside = target.exists().then(|| {
            let mut aside = target.clone().into_os_string();
            aside.push(".old");
            PathBuf::from(aside)
        });
        if let Some(aside) = &aside
            && let Err(err) = fs::rename(target, aside)
        {
            result = Err(err);
            break;
        }
        moved.push((target, aside));
        if let Err(err) = fs::rename(unpacked, target) {
            result = Err(err);
            break;
        }
    }
    for (target, aside) in moved {
        let _ = match (&result, aside) {
            (Ok(()), Some(aside)) => fs::remove_file(aside),
            (Err(_), Some(aside)) => fs::rename(aside, target),
            (Err(_), None) => fs::remove_file(target),
            (Ok(()), None) => Ok(()),
        };
    }
    if result.is_err() {
        for (unpacked, _) in pack {
            let _ = fs::remove_file(unpacked);
        }
    }
    result
}

/// Unpacks the package's capture pack files (`<folder>/capture-pack/<file>`)
/// into `to` as `<file>.new`. Returns each unpacked file with the name it
/// takes once placed.
fn unpack_pack(package: &[u8], to: &Path) -> Result<Vec<(PathBuf, PathBuf)>> {
    let mut archive = zip::ZipArchive::new(Cursor::new(package))?;
    let files: Vec<(String, String)> = archive
        .file_names()
        .filter_map(Result::ok)
        .filter_map(|name| {
            let mut parts = name.split('/');
            let (_, folder, file) = (parts.next()?, parts.next()?, parts.next()?);
            let plain = !file.is_empty()
                && !file.starts_with('.')
                && !file.contains(['\\', ':'])
                && parts.next().is_none();
            (folder == PACK_DIR && plain).then(|| (name.to_string(), file.to_owned()))
        })
        .collect();
    if files.is_empty() {
        return Ok(Vec::new());
    }
    fs::create_dir_all(to)?;
    let mut unpacked = Vec::new();
    for (name, file) in &files {
        let new = to.join(format!("{file}.new"));
        let mut entry = archive.by_name(name)?;
        let mut out = fs::File::create(&new)?;
        copy(&mut entry, &mut out)?;
        out.sync_all()?;
        unpacked.push((new, to.join(file)));
    }
    Ok(unpacked)
}

/// Deletes the `.new` files an unpacking left in the pack folder.
fn remove_unpacked(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if entry.path().extension().is_some_and(|ext| ext == "new") {
            let _ = fs::remove_file(entry.path());
        }
    }
}

/// The package holds one program, `Moongazer/Moongazer.exe`, the marker and,
/// with auto sync, the capture pack.
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
    fn the_capture_pack_is_replaced_with_the_program() {
        let dir = temp_dir("pack");
        let exe = dir.join("Moongazer.exe");
        fs::write(&exe, b"old").unwrap();
        fs::create_dir_all(dir.join("capture-pack")).unwrap();
        fs::write(dir.join("capture-pack/pack.json"), b"old pack").unwrap();
        let zip = package(&[
            ("Moongazer/Moongazer.exe", b"new"),
            ("Moongazer/capture-pack/pack.json", b"new pack"),
            ("Moongazer/capture-pack/game_data.gz", b"data"),
            ("Moongazer/capture-pack/../evil", b"no"),
            ("Moongazer/other/x", b"no"),
        ]);
        replace_exe(&exe, &zip).unwrap();
        assert_eq!(fs::read(&exe).unwrap(), b"new");
        assert_eq!(
            fs::read(dir.join("capture-pack/pack.json")).unwrap(),
            b"new pack"
        );
        assert_eq!(
            fs::read(dir.join("capture-pack/game_data.gz")).unwrap(),
            b"data"
        );
        assert!(!dir.join("evil").exists() && !dir.join("other").exists());
        assert!(!dir.join("capture-pack/pack.json.new").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn a_pack_that_cannot_be_placed_whole_puts_program_and_pack_back() {
        use std::os::windows::fs::OpenOptionsExt;

        let dir = temp_dir("pack-locked");
        let exe = dir.join("Moongazer.exe");
        fs::write(&exe, b"old").unwrap();
        fs::create_dir_all(dir.join("capture-pack")).unwrap();
        fs::write(dir.join("capture-pack/pack.json"), b"old pack").unwrap();
        fs::write(dir.join("capture-pack/gi.json"), b"old keys").unwrap();
        let zip = package(&[
            ("Moongazer/Moongazer.exe", b"new"),
            ("Moongazer/capture-pack/pack.json", b"new pack"),
            ("Moongazer/capture-pack/game_data.gz", b"data"),
            ("Moongazer/capture-pack/gi.json", b"new keys"),
        ]);
        // Held open without sharing, as another program might: it cannot be moved.
        let held = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(dir.join("capture-pack/gi.json"))
            .unwrap();
        assert!(replace_exe(&exe, &zip).is_err());
        drop(held);
        assert_eq!(fs::read(&exe).unwrap(), b"old");
        assert!(!dir.join("Moongazer.exe.old").exists());
        assert_eq!(
            fs::read(dir.join("capture-pack/pack.json")).unwrap(),
            b"old pack"
        );
        assert_eq!(
            fs::read(dir.join("capture-pack/gi.json")).unwrap(),
            b"old keys"
        );
        let mut left: Vec<_> = fs::read_dir(dir.join("capture-pack"))
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        left.sort();
        assert_eq!(left, ["gi.json", "pack.json"]);
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
