// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The home page's tasks: custom tasks and ticks by hand, one JSON document
//! per account that the page writes and checks. Kept by UID, as the planner.

use tauri::State;

use crate::snapshots::{SnapshotError, Storage};

pub(crate) fn key(uid: u64) -> String {
    format!("tasks:{uid}")
}

/// The account's tasks; `None` before its first save.
#[tauri::command]
pub async fn tasks_data(
    storage: State<'_, Storage>,
    uid: u64,
) -> Result<Option<String>, SnapshotError> {
    storage.read_setting(&key(uid))
}

#[tauri::command]
pub async fn save_tasks_data(
    storage: State<'_, Storage>,
    uid: u64,
    data: String,
) -> Result<(), SnapshotError> {
    storage.set_setting(&key(uid), &data)?;
    tracing::info!(bytes = data.len(), "tasks saved");
    Ok(())
}
