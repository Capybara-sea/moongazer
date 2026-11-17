// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The app's SQLite database: account snapshots.
//!
//! A snapshot is one row: when the data was read, where it came from, a
//! summary, and the original export compressed. Only the newest
//! [`FULL_SNAPSHOTS`] keep the export; older rows keep their summary for good,
//! so the Mora and Primogem history never runs out.

use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::time::Duration;

use account::{Export, Format, Summary, Warning};
use anyhow::{Context, Result, bail};
use flate2::Compression;
use flate2::read::DeflateDecoder;
use flate2::write::DeflateEncoder;
use rusqlite::types::Type;
use rusqlite::{Connection, OptionalExtension, Row, Transaction, params};
use serde::Serialize;

pub const FULL_SNAPSHOTS: u32 = 100;

type Migration = fn(&Transaction<'_>) -> Result<()>;

/// Schema changes, in order. `user_version` counts how many have run.
const MIGRATIONS: &[Migration] = &[create_snapshots, add_rarities_and_essence];

fn create_snapshots(tx: &Transaction<'_>) -> Result<()> {
    tx.execute_batch(
        "
        CREATE TABLE snapshots (
            id INTEGER PRIMARY KEY,
            -- Unix milliseconds: when the data was read, and when it was imported.
            taken_at INTEGER NOT NULL,
            imported_at INTEGER NOT NULL,
            format TEXT NOT NULL,
            source TEXT NOT NULL,
            uid INTEGER,
            content_hash BLOB NOT NULL UNIQUE,
            characters INTEGER NOT NULL,
            weapons INTEGER NOT NULL,
            artifacts INTEGER NOT NULL,
            materials INTEGER NOT NULL,
            mora INTEGER,
            primogems INTEGER,
            -- The export, deflated; NULL once it falls out of the newest ones.
            raw BLOB
        );
        CREATE INDEX snapshots_taken_at ON snapshots (taken_at);
        ",
    )?;
    Ok(())
}

/// Older rows get the new counts from their kept export; rows without one
/// keep NULL.
fn add_rarities_and_essence(tx: &Transaction<'_>) -> Result<()> {
    tx.execute_batch(
        "
        ALTER TABLE snapshots ADD COLUMN artifacts_4 INTEGER;
        ALTER TABLE snapshots ADD COLUMN artifacts_3 INTEGER;
        ALTER TABLE snapshots ADD COLUMN essence INTEGER;
        ",
    )?;
    let mut summaries = Vec::new();
    let mut select = tx.prepare("SELECT id, raw FROM snapshots WHERE raw IS NOT NULL")?;
    let mut rows = select.query([])?;
    while let Some(row) = rows.next()? {
        let raw: Vec<u8> = row.get(1)?;
        // Every kept export parsed when it was imported. Should one stop
        // parsing, its row keeps NULL rather than the app failing to start.
        if let Some(export) = decompress(&raw)
            .ok()
            .and_then(|bytes| account::parse(&bytes).ok())
        {
            summaries.push((row.get::<_, i64>(0)?, export.summary()));
        }
    }
    let mut update = tx.prepare(
        "UPDATE snapshots SET artifacts_4 = ?2, artifacts_3 = ?3, essence = ?4 WHERE id = ?1",
    )?;
    for (id, summary) in summaries {
        update.execute(params![
            id,
            summary.artifacts4,
            summary.artifacts3,
            summary.essence
        ])?;
    }
    Ok(())
}

const COLUMNS: &str = "id, taken_at, imported_at, format, source, uid, characters, weapons, \
                       artifacts, artifacts_4, artifacts_3, materials, mora, primogems, essence, \
                       raw IS NOT NULL";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: i64,
    pub taken_at: i64,
    pub imported_at: i64,
    pub format: Format,
    pub source: String,
    /// Only for telling accounts apart; the UI never shows it.
    #[serde(skip)]
    pub uid: Option<u64>,
    pub summary: Summary,
    /// Whether the original export is still kept.
    pub has_raw: bool,
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Outcome {
    Saved {
        snapshot: Snapshot,
    },
    /// A snapshot with the same content exists.
    Duplicate {
        taken_at: i64,
    },
    NeedsConfirmation {
        warnings: Vec<Warning>,
    },
}

pub struct Db {
    conn: Connection,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir).with_context(|| format!("creating {}", dir.display()))?;
        }
        let conn = Connection::open(path).with_context(|| format!("opening {}", path.display()))?;
        Self::setup(conn)
    }

    pub fn open_in_memory() -> Result<Self> {
        Self::setup(Connection::open_in_memory()?)
    }

    fn setup(mut conn: Connection) -> Result<Self> {
        conn.busy_timeout(Duration::from_secs(5))?;
        // The pragma answers with the mode, which stays "memory" in memory.
        let _mode: String = conn.query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0))?;
        migrate(&mut conn)?;
        Ok(Self { conn })
    }

    /// Saves `export` as a snapshot taken at `taken_at` (unix milliseconds),
    /// unless the same content is stored already, or, until `confirmed`, it
    /// looks wrong next to the snapshot before it.
    pub fn import(
        &mut self,
        export: &Export,
        raw: &[u8],
        taken_at: i64,
        now: i64,
        confirmed: bool,
    ) -> Result<Outcome> {
        let existing = self
            .conn
            .query_row(
                "SELECT taken_at FROM snapshots WHERE content_hash = ?1",
                [&export.content_hash[..]],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(taken_at) = existing {
            return Ok(Outcome::Duplicate { taken_at });
        }

        let summary = export.summary();
        let uid = export.uid();
        if !confirmed && let Some(previous) = self.latest_before(taken_at)? {
            let warnings = account::warnings(&previous.summary, previous.uid, &summary, uid);
            if !warnings.is_empty() {
                return Ok(Outcome::NeedsConfirmation { warnings });
            }
        }

        let compressed = compress(raw)?;
        let tx = self.conn.transaction()?;
        tx.execute(
            "INSERT INTO snapshots (taken_at, imported_at, format, source, uid, content_hash,
                 characters, weapons, artifacts, artifacts_4, artifacts_3, materials, mora,
                 primogems, essence, raw)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                taken_at,
                now,
                export.format.as_str(),
                export.data.source,
                uid,
                &export.content_hash[..],
                summary.characters,
                summary.weapons,
                summary.artifacts,
                summary.artifacts4,
                summary.artifacts3,
                summary.materials,
                summary.mora,
                summary.primogems,
                summary.essence,
                compressed,
            ],
        )?;
        let id = tx.last_insert_rowid();
        // Free pages are reused by later inserts, so the file stops growing
        // once it holds the newest exports.
        tx.execute(
            "UPDATE snapshots SET raw = NULL WHERE raw IS NOT NULL AND id NOT IN
                 (SELECT id FROM snapshots ORDER BY taken_at DESC, id DESC LIMIT ?1)",
            [FULL_SNAPSHOTS],
        )?;
        tx.commit()?;
        let snapshot = self.conn.query_row(
            &format!("SELECT {COLUMNS} FROM snapshots WHERE id = ?1"),
            [id],
            snapshot,
        )?;
        Ok(Outcome::Saved { snapshot })
    }

    /// Every snapshot, newest first.
    pub fn list(&self) -> Result<Vec<Snapshot>> {
        let mut statement = self.conn.prepare(&format!(
            "SELECT {COLUMNS} FROM snapshots ORDER BY taken_at DESC, id DESC"
        ))?;
        let rows = statement.query_map([], snapshot)?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// The original export of a snapshot, if it is still kept.
    pub fn raw(&self, id: i64) -> Result<Option<Vec<u8>>> {
        let compressed: Option<Vec<u8>> = self
            .conn
            .query_row("SELECT raw FROM snapshots WHERE id = ?1", [id], |row| {
                row.get(0)
            })
            .optional()?
            .flatten();
        compressed.map(|bytes| decompress(&bytes)).transpose()
    }

    fn latest_before(&self, taken_at: i64) -> Result<Option<Snapshot>> {
        Ok(self
            .conn
            .query_row(
                &format!(
                    "SELECT {COLUMNS} FROM snapshots WHERE taken_at <= ?1
                     ORDER BY taken_at DESC, id DESC LIMIT 1"
                ),
                [taken_at],
                snapshot,
            )
            .optional()?)
    }
}

fn migrate(conn: &mut Connection) -> Result<()> {
    let version: usize = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version > MIGRATIONS.len() {
        bail!("the database is from a newer version of the app (schema {version})");
    }
    for (done, migration) in MIGRATIONS.iter().enumerate().skip(version) {
        let tx = conn.transaction()?;
        migration(&tx)?;
        tx.pragma_update(None, "user_version", done + 1)?;
        tx.commit()?;
    }
    Ok(())
}

fn snapshot(row: &Row<'_>) -> rusqlite::Result<Snapshot> {
    let format: String = row.get(3)?;
    let format = Format::parse(&format).ok_or_else(|| {
        rusqlite::Error::FromSqlConversionFailure(3, Type::Text, format!("format {format}").into())
    })?;
    Ok(Snapshot {
        id: row.get(0)?,
        taken_at: row.get(1)?,
        imported_at: row.get(2)?,
        format,
        source: row.get(4)?,
        uid: row.get(5)?,
        summary: Summary {
            characters: row.get(6)?,
            weapons: row.get(7)?,
            artifacts: row.get(8)?,
            artifacts4: row.get(9)?,
            artifacts3: row.get(10)?,
            materials: row.get(11)?,
            mora: row.get(12)?,
            primogems: row.get(13)?,
            essence: row.get(14)?,
        },
        has_raw: row.get(15)?,
    })
}

fn compress(bytes: &[u8]) -> Result<Vec<u8>> {
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(bytes)?;
    Ok(encoder.finish()?)
}

fn decompress(bytes: &[u8]) -> Result<Vec<u8>> {
    let mut out = Vec::new();
    DeflateDecoder::new(bytes).read_to_end(&mut out)?;
    Ok(out)
}

#[cfg(test)]
mod tests;
