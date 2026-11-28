// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Auto sync's settings, kept in the database because the app reads them
//! before the page loads. Stored as JSON values.

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use super::service::AutoSync;
use crate::snapshots::{SnapshotError, Storage};

/// Starts auto sync with the app. Off by default: it asks for elevation.
const AUTO_START: &str = "sync.autoStart";
/// Captures with raw sockets, set once a PC turned out to need it.
const COMPATIBLE: &str = "sync.compatibleCapture";
/// Reads the wish history when the game's history opens. Off by default: it
/// sends the game's key to the game's API.
const WISH_AUTO_READ: &str = "wishes.autoRead";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSettings {
    auto_start: bool,
    wish_auto_read: bool,
}

fn flag(app: &AppHandle, key: &str) -> bool {
    app.state::<Storage>().setting(key).as_deref() == Some("true")
}

pub fn auto_start(app: &AppHandle) -> bool {
    flag(app, AUTO_START)
}

pub fn compatible_capture(app: &AppHandle) -> bool {
    flag(app, COMPATIBLE)
}

pub fn wish_auto_read(app: &AppHandle) -> bool {
    flag(app, WISH_AUTO_READ)
}

pub fn set_compatible_capture(app: &AppHandle, on: bool) {
    if let Err(err) = app
        .state::<Storage>()
        .set_setting(COMPATIBLE, &on.to_string())
    {
        tracing::error!(error = ?err, "saving the compatible capture setting failed");
    }
}

#[tauri::command]
pub fn sync_settings(storage: State<'_, Storage>) -> SyncSettings {
    SyncSettings {
        auto_start: storage.setting(AUTO_START).as_deref() == Some("true"),
        wish_auto_read: storage.setting(WISH_AUTO_READ).as_deref() == Some("true"),
    }
}

#[tauri::command]
pub fn set_sync_auto_start(storage: State<'_, Storage>, on: bool) -> Result<(), SnapshotError> {
    storage.set_setting(AUTO_START, &on.to_string())
}

#[tauri::command]
pub fn set_wish_auto_read(
    storage: State<'_, Storage>,
    sync: State<'_, AutoSync>,
    on: bool,
) -> Result<(), SnapshotError> {
    storage.set_setting(WISH_AUTO_READ, &on.to_string())?;
    sync.set_wish_auto_read(on);
    Ok(())
}
