// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Where the installed build keeps its data: the default local data folder,
//! or a folder the user chose. The choice is a file in the roaming config
//! folder, read before the app is built, since Tauri resolves its directories
//! once. A move runs in the next process, before the webview and the database
//! open the folder: the running app holds both open.

use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use serde::Serialize;
use tauri::utils::config::AppDirectoriesOverride;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::snapshots::DB_FILE;

/// The restarted app moves the data to the folder after this argument.
const MOVE_ARG: &str = "--move-data-to";
/// Holds the chosen folder; missing means the default one.
const POINTER: &str = "data-location";
/// Long enough for the previous process and its webview to let go of the files.
const WAIT_FOR_FILES: Duration = Duration::from_secs(30);

pub struct DataLocation {
    pub dir: PathBuf,
    default: PathBuf,
    /// The portable build keeps its data beside the executable, always.
    movable: bool,
}

impl DataLocation {
    /// A folder that stays where it is: the portable build's.
    pub fn fixed(dir: PathBuf) -> Self {
        Self {
            default: dir.clone(),
            dir,
            movable: false,
        }
    }
}

/// The installed build's folder, after the move the previous process asked
/// for. A failed move shows why and keeps the folder the data is in.
pub fn resolve<R: tauri::Runtime>(context: &mut tauri::Context<R>) -> Option<DataLocation> {
    let identifier = &context.config().identifier;
    let default = PathBuf::from(std::env::var_os("LOCALAPPDATA")?).join(identifier);
    let pointer = PathBuf::from(std::env::var_os("APPDATA")?)
        .join(identifier)
        .join(POINTER);
    let mut dir = fs::read_to_string(&pointer)
        .ok()
        .map(|text| PathBuf::from(text.trim()))
        .filter(|dir| dir.is_absolute())
        .unwrap_or_else(|| default.clone());

    if let Some(target) = move_target() {
        match move_data(&dir, &target).and_then(|()| point_to(&pointer, &target, &default)) {
            Ok(()) => dir = target,
            Err(err) => crate::win::error_box(
                crate::text::APP_NAME,
                &format!("{}\n{err:#}", crate::text::MOVE_DATA_FAILED),
            ),
        }
    }
    if !same(&dir, &default) {
        context.config_mut().app.app_directories_override =
            Some(AppDirectoriesOverride::Root(dir.clone()));
    }
    Some(DataLocation {
        dir,
        default,
        movable: true,
    })
}

fn move_target() -> Option<PathBuf> {
    let mut args = std::env::args_os().skip_while(|arg| arg != MOVE_ARG);
    args.next()?;
    args.next().map(PathBuf::from)
}

fn point_to(pointer: &Path, dir: &Path, default: &Path) -> Result<()> {
    if same(dir, default) {
        return match fs::remove_file(pointer) {
            Err(err) if err.kind() != io::ErrorKind::NotFound => {
                Err(err).context("resetting the data location")
            }
            _ => Ok(()),
        };
    }
    if let Some(parent) = pointer.parent() {
        fs::create_dir_all(parent).context("saving the data location")?;
    }
    fs::write(pointer, dir.as_os_str().to_string_lossy().as_bytes())
        .context("saving the data location")
}

/// Moves `from` to `to`, or only switches when `to` has data of its own or
/// there is nothing to move yet.
fn move_data(from: &Path, to: &Path) -> Result<()> {
    if to.join(DB_FILE).is_file() || !from.exists() {
        return Ok(());
    }
    if to.exists() {
        fs::remove_dir(to).context("the new folder is not empty")?;
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).context("creating the new folder")?;
    }
    match retry(|| fs::rename(from, to)) {
        Err(err) if err.kind() == io::ErrorKind::CrossesDevices => copy_across(from, to),
        moved => moved.context("moving the data"),
    }
}

/// Another drive: copied, then deleted. Renamed aside first, which waits until
/// no file in it is open and keeps the app from finding a half-moved folder.
fn copy_across(from: &Path, to: &Path) -> Result<()> {
    let aside = with_suffix(from, ".moving");
    let partial = with_suffix(to, ".partial");
    retry(|| fs::rename(from, &aside)).context("the data folder is still in use")?;
    let copied = copy_dir(&aside, &partial)
        .and_then(|()| fs::rename(&partial, to).context("putting the copy in place"));
    if let Err(err) = copied {
        let _ = fs::remove_dir_all(&partial);
        fs::rename(&aside, from).context("putting the data back")?;
        return Err(err.context("copying the data"));
    }
    if fs::remove_dir_all(&aside).is_err() {
        tracing::warn!("the old data folder could not be deleted");
    }
    Ok(())
}

fn copy_dir(from: &Path, to: &Path) -> Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

/// Retries while the previous process (and its webview) still hold files.
fn retry(mut step: impl FnMut() -> io::Result<()>) -> io::Result<()> {
    let start = Instant::now();
    loop {
        match step() {
            Err(err)
                if err.kind() != io::ErrorKind::CrossesDevices
                    && start.elapsed() < WAIT_FOR_FILES =>
            {
                thread::sleep(Duration::from_millis(500));
            }
            done => return done,
        }
    }
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = OsString::from(path.as_os_str());
    name.push(suffix);
    PathBuf::from(name)
}

/// Windows paths ignore case and a trailing separator.
fn key(path: &Path) -> PathBuf {
    PathBuf::from(path.to_string_lossy().to_lowercase())
}

fn same(a: &Path, b: &Path) -> bool {
    key(a) == key(b)
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum LocationError {
    NotMovable,
    Same,
    /// One folder is inside the other.
    Nested,
    NotEmpty,
    Unwritable,
    Failed(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDir {
    dir: String,
    is_default: bool,
    movable: bool,
}

/// Where the database, logs and caches are.
#[tauri::command]
pub fn data_dir(location: State<'_, DataLocation>) -> DataDir {
    DataDir {
        dir: location.dir.display().to_string(),
        is_default: same(&location.dir, &location.default),
        movable: location.movable,
    }
}

/// A folder the data can go to, and whether it already has data of its own.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    dir: String,
    existing: bool,
}

/// The default folder, or one the user picks (None when they cancel). A
/// picked folder with no data of its own gets a subfolder named like the
/// default one, so the data never spills into a drive's root.
#[tauri::command]
pub async fn plan_data_dir(
    app: AppHandle,
    location: State<'_, DataLocation>,
    default: bool,
) -> Result<Option<Plan>, LocationError> {
    if !location.movable {
        return Err(LocationError::NotMovable);
    }
    let dir = if default {
        location.default.clone()
    } else {
        let mut dialog = app.dialog().file().set_title(crate::text::PICK_DATA_DIR);
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window);
        }
        let Some(picked) = dialog.blocking_pick_folder() else {
            return Ok(None);
        };
        let picked = picked
            .into_path()
            .map_err(|err| LocationError::Failed(err.to_string()))?;
        match location.default.file_name() {
            Some(name) if !picked.join(DB_FILE).is_file() => picked.join(name),
            _ => picked,
        }
    };
    let existing = check(&location.dir, &dir)?;
    Ok(Some(Plan {
        dir: dir.display().to_string(),
        existing,
    }))
}

/// Whether `to` can take the data: true when it has data of its own.
fn check(current: &Path, to: &Path) -> Result<bool, LocationError> {
    if same(current, to) {
        return Err(LocationError::Same);
    }
    if key(to).starts_with(key(current)) || key(current).starts_with(key(to)) {
        return Err(LocationError::Nested);
    }
    if to.join(DB_FILE).is_file() {
        return Ok(true);
    }
    if fs::read_dir(to).is_ok_and(|mut entries| entries.next().is_some()) || to.is_file() {
        return Err(LocationError::NotEmpty);
    }
    let probe = to.ancestors().find(|dir| dir.is_dir());
    if !probe.is_some_and(crate::portable::writable) {
        return Err(LocationError::Unwritable);
    }
    Ok(false)
}

/// Restarts into `dir`, which a plan gave; the next process moves the data.
#[tauri::command]
pub fn move_data_dir(
    app: AppHandle,
    location: State<'_, DataLocation>,
    dir: String,
) -> Result<(), LocationError> {
    if !location.movable {
        return Err(LocationError::NotMovable);
    }
    let dir = PathBuf::from(dir);
    if !dir.is_absolute() {
        return Err(LocationError::Failed("not an absolute path".to_owned()));
    }
    check(&location.dir, &dir)?;
    tracing::info!("restarting to move the data");
    crate::update::relaunch(&app, &[MOVE_ARG.into(), dir.into_os_string()])
        .map_err(|err| LocationError::Failed(err.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("moongazer-location-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn moving_takes_the_whole_folder_along() {
        let root = temp("move");
        let from = root.join("from");
        fs::create_dir_all(from.join("logs")).expect("dirs");
        fs::write(from.join(DB_FILE), b"db").expect("db");
        fs::write(from.join("logs").join("a.log"), b"log").expect("log");
        let to = root.join("new").join("data");
        move_data(&from, &to).expect("moved");
        assert!(!from.exists());
        assert_eq!(
            fs::read(to.join("logs").join("a.log")).expect("log"),
            b"log"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn copying_to_another_drive_leaves_no_trace_behind() {
        let root = temp("copy");
        let from = root.join("from");
        fs::create_dir_all(from.join("logs")).expect("dirs");
        fs::write(from.join("logs").join("a.log"), b"log").expect("log");
        let to = root.join("to");
        copy_across(&from, &to).expect("copied");
        assert!(!from.exists());
        assert!(!with_suffix(&from, ".moving").exists());
        assert!(!with_suffix(&to, ".partial").exists());
        assert_eq!(
            fs::read(to.join("logs").join("a.log")).expect("log"),
            b"log"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn a_folder_with_data_of_its_own_is_only_switched_to() {
        let root = temp("existing");
        let (from, to) = (root.join("from"), root.join("to"));
        for dir in [&from, &to] {
            fs::create_dir_all(dir).expect("dir");
            fs::write(dir.join(DB_FILE), b"db").expect("db");
        }
        move_data(&from, &to).expect("switched");
        assert!(from.join(DB_FILE).is_file());
        assert_eq!(check(&from, &to).ok(), Some(true));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn check_refuses_the_same_nested_and_non_empty_folders() {
        let root = temp("check");
        let current = root.join("Current");
        fs::create_dir_all(&current).expect("dir");
        fs::write(root.join("stray.txt"), b"x").expect("file");
        assert!(matches!(
            check(&current, &root.join("current\\")),
            Err(LocationError::Same)
        ));
        assert!(matches!(
            check(&current, &current.join("x")),
            Err(LocationError::Nested)
        ));
        assert!(matches!(check(&current, &root), Err(LocationError::Nested)));
        let busy = root.join("busy");
        fs::create_dir_all(&busy).expect("dir");
        fs::write(busy.join("stray.txt"), b"x").expect("file");
        assert!(matches!(
            check(&current, &busy),
            Err(LocationError::NotEmpty)
        ));
        assert_eq!(
            check(&current, &root.join("fresh").join("data")).ok(),
            Some(false)
        );
        let _ = fs::remove_dir_all(&root);
    }
}
