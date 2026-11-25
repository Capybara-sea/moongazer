// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The planner's goals: one JSON document per account, which the page
//! writes and checks. Kept by UID, as the page's account token changes when
//! the account's first snapshot is deleted.

use tauri::State;

use crate::snapshots::{SnapshotError, Storage};

pub(crate) fn key(uid: u64) -> String {
    format!("planner:{uid}")
}

/// The account's planner; `None` before its first save.
#[tauri::command]
pub async fn planner_data(
    storage: State<'_, Storage>,
    uid: u64,
) -> Result<Option<String>, SnapshotError> {
    storage.read_setting(&key(uid))
}

#[tauri::command]
pub async fn save_planner_data(
    storage: State<'_, Storage>,
    uid: u64,
    data: String,
) -> Result<(), SnapshotError> {
    storage.set_setting(&key(uid), &data)?;
    tracing::info!(bytes = data.len(), "planner saved");
    Ok(())
}
