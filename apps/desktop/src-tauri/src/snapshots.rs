// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Snapshot commands: importing Leyline files, listing the history,
//! reading back kept exports, and auto sync's timelines. The database lives
//! in the app's local data directory, which the portable build keeps in
//! `app-data`.

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use account::{Export, Keys, ParseError};
use serde::Serialize;
use storage::{Check, Db, Outcome, Session, Snapshot};
use tauri::State;

const DB_FILE: &str = "moongazer.db";

/// The database, or why it could not be opened. The app starts either way,
/// so the reason can be shown on the page.
pub struct Storage {
    dir: PathBuf,
    db: Mutex<Result<Db, String>>,
    live: Mutex<Option<Live>>,
}

/// The export auto sync holds now, which its newest batch led to: the page
/// gets it as it is, not rebuilt. Only auto sync sets one.
struct Live {
    batch: i64,
    json: String,
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
            live: Mutex::new(None),
        }
    }

    fn lock(&self) -> MutexGuard<'_, Result<Db, String>> {
        self.db.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn live(&self) -> MutexGuard<'_, Option<Live>> {
        self.live.lock().unwrap_or_else(|e| e.into_inner())
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum SnapshotError {
    /// Not JSON, or a field of the wrong type; serde's message.
    Invalid(String),
    NotGood,
    UnsupportedVersion(u64),
    NotLeyline,
    Storage(String),
    OpenFolder(String),
}

impl From<ParseError> for SnapshotError {
    fn from(err: ParseError) -> Self {
        match err {
            ParseError::Json(err) => Self::Invalid(err.to_string()),
            ParseError::NotGood => Self::NotGood,
            ParseError::UnsupportedVersion(version) => Self::UnsupportedVersion(version),
            ParseError::NotLeyline => Self::NotLeyline,
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

/// Imports one file. The page sends the file's modification time (unix
/// milliseconds) for a file without a time of its own.
#[tauri::command]
pub async fn import_snapshot(
    storage: State<'_, Storage>,
    text: String,
    modified_at: Option<i64>,
    confirmed: bool,
) -> Result<Imported, SnapshotError> {
    let check = if confirmed {
        Check::Confirmed
    } else {
        Check::Ask
    };
    import(&storage, &text, modified_at, check)
}

/// The snapshot an auto sync export went to.
#[cfg(feature = "capture")]
pub struct Captured {
    /// False when the same content was stored already.
    pub saved: bool,
    /// The session it joined: a new one when the one asked for was over.
    pub session: Option<i64>,
}

/// Saves an export auto sync read (`text`, parsed as `export`), marked for
/// review when it looks wrong next to its account's snapshot before it.
#[cfg(feature = "capture")]
pub fn import_capture(
    storage: &Storage,
    export: &Export,
    text: &str,
    session: Option<Session>,
) -> Option<Captured> {
    match save(storage, export, text, None, Check::Mark, session) {
        Ok(Outcome::Saved { snapshot }) => {
            if snapshot.review {
                tracing::warn!(
                    "the snapshot looks wrong next to the one before; marked for review"
                );
            }
            Some(Captured {
                saved: true,
                session: snapshot.session,
            })
        }
        Ok(Outcome::Duplicate { id, .. }) => Some(Captured {
            saved: false,
            session: match session {
                Some(Session::New) => Some(id),
                Some(Session::Of(login)) => Some(login),
                None => None,
            },
        }),
        // Never with `Check::Mark`.
        Ok(Outcome::NeedsConfirmation { .. }) => None,
        Err(err) => {
            tracing::error!(error = ?err, "saving the snapshot failed");
            None
        }
    }
}

fn import(
    storage: &Storage,
    text: &str,
    modified_at: Option<i64>,
    check: Check,
) -> Result<Imported, SnapshotError> {
    let export = account::parse(text.as_bytes())?;
    let outcome = save(storage, &export, text, modified_at, check, None)?;
    Ok(Imported {
        outcome,
        keys: export.keys(),
    })
}

fn save(
    storage: &Storage,
    export: &Export,
    text: &str,
    modified_at: Option<i64>,
    check: Check,
    session: Option<Session>,
) -> Result<Outcome, SnapshotError> {
    let now = now_ms();
    let taken_at = export.taken_at().or(modified_at).unwrap_or(now);
    let mut guard = storage.lock();
    let db = guard
        .as_mut()
        .map_err(|err| SnapshotError::Storage(err.clone()))?;
    let outcome = db
        .import(export, text.as_bytes(), taken_at, now, check, session)
        .map_err(storage_error)?;
    tracing::info!(
        bytes = text.len(),
        outcome = match outcome {
            Outcome::Saved { .. } => "saved",
            Outcome::Duplicate { .. } => "duplicate",
            Outcome::NeedsConfirmation { .. } => "needs confirmation",
        },
        "import finished"
    );
    Ok(outcome)
}

/// Keeps a snapshot auto sync marked for review.
#[tauri::command]
pub async fn keep_snapshot(storage: State<'_, Storage>, id: i64) -> Result<(), SnapshotError> {
    let guard = storage.lock();
    let db = guard
        .as_ref()
        .map_err(|err| SnapshotError::Storage(err.clone()))?;
    db.keep(id).map_err(storage_error)
}

/// Deletes a snapshot; a login snapshot takes its session's batches along.
#[tauri::command]
pub async fn delete_snapshot(storage: State<'_, Storage>, id: i64) -> Result<(), SnapshotError> {
    let mut guard = storage.lock();
    let db = guard
        .as_mut()
        .map_err(|err| SnapshotError::Storage(err.clone()))?;
    db.delete(id).map_err(storage_error)?;
    tracing::info!("snapshot deleted");
    Ok(())
}

#[cfg(feature = "capture")]
impl Storage {
    /// A stored setting; `None` when unset or when the database is
    /// unavailable.
    pub fn setting(&self, key: &str) -> Option<String> {
        let guard = self.lock();
        let db = guard.as_ref().ok()?;
        db.setting(key).unwrap_or_else(|err| {
            tracing::error!(error = %format!("{err:#}"), key, "reading a setting failed");
            None
        })
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), SnapshotError> {
        let guard = self.lock();
        let db = guard
            .as_ref()
            .map_err(|err| SnapshotError::Storage(err.clone()))?;
        db.set_setting(key, value).map_err(storage_error)
    }

    /// Stores a batch of `session`'s changes, which lead to `export`, read
    /// at `at`. Its id; `None` when the session's login snapshot is gone.
    pub fn append_batch(
        &self,
        session: i64,
        at: i64,
        export: &Export,
        changes: &[account::delta::Change],
    ) -> Result<Option<i64>, String> {
        let json = serde_json::to_vec(changes).map_err(|err| err.to_string())?;
        let summary = export.summary();
        let guard = self.lock();
        let db = guard.as_ref().map_err(Clone::clone)?;
        db.append_batch(session, at, &summary, &export.content_hash, &json)
            .map_err(|err| format!("{err:#}"))
    }

    /// Makes `json`, the export batch `batch` led to, the live point. Its
    /// head row.
    pub fn set_live(&self, batch: i64, json: String) -> Option<Snapshot> {
        *self.live() = Some(Live { batch, json });
        let guard = self.lock();
        let head = guard.as_ref().ok()?.head(batch).unwrap_or_else(|err| {
            tracing::error!(error = %format!("{err:#}"), "reading a batch failed");
            None
        })?;
        Some(Snapshot {
            live: true,
            has_raw: true,
            ..head
        })
    }

    /// The live point is gone: a snapshot holds it now, or the login ended.
    /// Whether there was one.
    pub fn clear_live(&self) -> bool {
        self.live().take().is_some()
    }
}

/// Every snapshot and every session's head row, newest first.
#[tauri::command]
pub async fn list_snapshots(storage: State<'_, Storage>) -> Result<Vec<Snapshot>, SnapshotError> {
    let mut list = {
        let guard = storage.lock();
        let db = guard
            .as_ref()
            .map_err(|err| SnapshotError::Storage(err.clone()))?;
        db.list().map_err(storage_error)?
    };
    if let Some(live) = storage.live().as_ref() {
        for row in list.iter_mut().filter(|row| row.id == -live.batch) {
            row.live = true;
            row.has_raw = true;
        }
    }
    Ok(list)
}

/// The original export of a snapshot, or `None` once it is no longer kept.
/// A head row's (negative id) is rebuilt, or the one held when it is live.
#[tauri::command]
pub async fn snapshot_export(
    storage: State<'_, Storage>,
    id: i64,
) -> Result<Option<String>, SnapshotError> {
    let text = if id < 0 {
        head_export(&storage, id)?
    } else {
        let raw = {
            let guard = storage.lock();
            let db = guard
                .as_ref()
                .map_err(|err| SnapshotError::Storage(err.clone()))?;
            db.raw(id).map_err(storage_error)?
        };
        raw.map(String::from_utf8)
            .transpose()
            .map_err(|err| SnapshotError::Storage(err.to_string()))?
    };
    tracing::info!(bytes = text.as_ref().map(String::len), "export read");
    Ok(text)
}

fn head_export(storage: &Storage, id: i64) -> Result<Option<String>, SnapshotError> {
    let Some(batch) = id.checked_neg() else {
        return Ok(None);
    };
    if let Some(live) = storage.live().as_ref().filter(|live| live.batch == batch) {
        return Ok(Some(live.json.clone()));
    }
    // Only reading happens under the lock; the rebuild runs outside it.
    let parts = {
        let guard = storage.lock();
        let db = guard
            .as_ref()
            .map_err(|err| SnapshotError::Storage(err.clone()))?;
        db.rebuild_parts(batch).map_err(storage_error)?
    };
    let Some(parts) = parts else {
        return Ok(None);
    };
    let batches = parts.batches.len();
    let text = account::delta::rebuild(
        &parts.base,
        parts.batches.iter().map(Vec::as_slice),
        parts.at,
        &parts.content_hash,
    )
    .map_err(|err| {
        tracing::error!(error = %err, batches, "rebuilding an export failed");
        SnapshotError::Storage(err.to_string())
    })?;
    tracing::info!(batches, "export rebuilt");
    Ok(Some(text))
}

/// An auto sync session's batches, oldest first: a JSON array of
/// `{id, at, changes}`, each `changes` as stored.
#[tauri::command]
pub async fn session_timeline(
    storage: State<'_, Storage>,
    session: i64,
) -> Result<String, SnapshotError> {
    let batches = {
        let guard = storage.lock();
        let db = guard
            .as_ref()
            .map_err(|err| SnapshotError::Storage(err.clone()))?;
        db.timeline(session).map_err(storage_error)?
    };
    let mut json = String::from("[");
    for (index, batch) in batches.iter().enumerate() {
        if index > 0 {
            json.push(',');
        }
        let changes = std::str::from_utf8(&batch.changes)
            .map_err(|err| SnapshotError::Storage(err.to_string()))?;
        json.push_str(&format!(
            r#"{{"id":{},"at":{},"changes":{changes}}}"#,
            batch.id, batch.at
        ));
    }
    json.push(']');
    tracing::info!(batches = batches.len(), bytes = json.len(), "timeline read");
    Ok(json)
}

/// Where the database, logs and caches are.
#[tauri::command]
pub fn data_dir(storage: State<'_, Storage>) -> String {
    storage.dir.display().to_string()
}

/// The log folder, under the data folder in both builds (portable: in
/// `app-data`).
#[tauri::command]
pub fn open_log_dir(app: tauri::AppHandle) -> Result<(), SnapshotError> {
    let dir = tauri::Manager::path(&app)
        .app_log_dir()
        .map_err(|err| SnapshotError::OpenFolder(err.to_string()))?;
    tauri_plugin_opener::open_path(&dir, None::<&str>)
        .map_err(|err| SnapshotError::OpenFolder(err.to_string()))
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
