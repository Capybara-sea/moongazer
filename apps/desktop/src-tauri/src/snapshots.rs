// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Snapshot commands: importing GOOD and Leyline files and listing the
//! history. The database lives in the app's local data directory, which the
//! portable build keeps in `app-data`.

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use account::{Keys, ParseError};
use serde::Serialize;
use storage::{Db, Outcome, Snapshot};
use tauri::State;

const DB_FILE: &str = "moongazer.db";

/// The database, or why it could not be opened. The app starts either way,
/// so the reason can be shown on the page.
pub struct Storage {
    dir: PathBuf,
    db: Mutex<Result<Db, String>>,
}

impl Storage {
    pub fn open(dir: PathBuf) -> Self {
        let db = Db::open(&dir.join(DB_FILE)).map_err(|err| {
            let message = format!("{err:#}");
            tracing::error!(error = %message, "opening the database failed");
            message
        });
        Self {
            dir,
            db: Mutex::new(db),
        }
    }

    fn lock(&self) -> MutexGuard<'_, Result<Db, String>> {
        self.db.lock().unwrap_or_else(|e| e.into_inner())
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum SnapshotError {
    /// Not JSON, or a field of the wrong type; serde's message.
    Invalid(String),
    NotGood,
    UnsupportedVersion(u64),
    Storage(String),
    OpenFolder(String),
}

impl From<ParseError> for SnapshotError {
    fn from(err: ParseError) -> Self {
        match err {
            ParseError::Json(err) => Self::Invalid(err.to_string()),
            ParseError::NotGood => Self::NotGood,
            ParseError::UnsupportedVersion(version) => Self::UnsupportedVersion(version),
        }
    }
}

fn storage_error(err: anyhow::Error) -> SnapshotError {
    SnapshotError::Storage(format!("{err:#}"))
}

#[derive(Serialize)]
pub struct Imported {
    outcome: Outcome,
    /// The file's distinct keys, for listing the ones the app has no name for.
    keys: Keys,
}

/// Imports one file. GOOD files carry no time of their own, so the page sends
/// the file's modification time (unix milliseconds) as a fallback.
#[tauri::command]
pub async fn import_snapshot(
    storage: State<'_, Storage>,
    text: String,
    modified_at: Option<i64>,
    confirmed: bool,
) -> Result<Imported, SnapshotError> {
    let export = account::parse(text.as_bytes())?;
    let now = now_ms();
    let taken_at = export.taken_at().or(modified_at).unwrap_or(now);
    let mut guard = storage.lock();
    let db = guard
        .as_mut()
        .map_err(|err| SnapshotError::Storage(err.clone()))?;
    let outcome = db
        .import(&export, text.as_bytes(), taken_at, now, confirmed)
        .map_err(storage_error)?;
    tracing::info!(
        bytes = text.len(),
        format = export.format.as_str(),
        outcome = match outcome {
            Outcome::Saved { .. } => "saved",
            Outcome::Duplicate { .. } => "duplicate",
            Outcome::NeedsConfirmation { .. } => "needs confirmation",
        },
        "import finished"
    );
    Ok(Imported {
        outcome,
        keys: export.keys(),
    })
}

/// Every snapshot, newest first.
#[tauri::command]
pub async fn list_snapshots(storage: State<'_, Storage>) -> Result<Vec<Snapshot>, SnapshotError> {
    let guard = storage.lock();
    let db = guard
        .as_ref()
        .map_err(|err| SnapshotError::Storage(err.clone()))?;
    db.list().map_err(storage_error)
}

/// Where the database, logs and caches are.
#[tauri::command]
pub fn data_dir(storage: State<'_, Storage>) -> String {
    storage.dir.display().to_string()
}

#[tauri::command]
pub fn open_data_dir(storage: State<'_, Storage>) -> Result<(), SnapshotError> {
    tauri_plugin_opener::open_path(&storage.dir, None::<&str>)
        .map_err(|err| SnapshotError::OpenFolder(err.to_string()))
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}
