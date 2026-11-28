// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The app's SQLite database: account snapshots, and the few settings the
//! app reads before the page loads.
//!
//! A snapshot is one row: when the data was read, where it came from, a
//! summary, and the original export compressed. The newest
//! [`FULL_SNAPSHOTS`] of each account keep the export; older rows keep their
//! summary for good, so the Mora and Primogem history never runs out.
//!
//! Auto sync also keeps, for good, what changed during a login, in batches
//! (see `account::delta`). A login is a session, named by the id of its
//! first snapshot (its login snapshot); its batches and later snapshots
//! carry that id.
//!
//! Each account's wish history is kept too ([`wishes`]).

use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::time::Duration;

use account::{Export, Summary, Warning};
use anyhow::{Context, Result, bail};
use flate2::Compression;
use flate2::read::DeflateDecoder;
use flate2::write::DeflateEncoder;
use rusqlite::{Connection, OptionalExtension, Row, Transaction, params};
use serde::Serialize;

mod wishes;

pub use wishes::Wish;

pub const FULL_SNAPSHOTS: u32 = 100;

type Migration = fn(&Transaction<'_>) -> Result<()>;

/// Schema changes, in order. `user_version` counts how many have run.
const MIGRATIONS: &[Migration] = &[
    create_snapshots,
    add_rarities_and_essence,
    add_settings_and_review,
    add_sessions_and_batches,
    wishes::create_wishes,
];

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

fn add_settings_and_review(tx: &Transaction<'_>) -> Result<()> {
    tx.execute_batch(
        "
        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        -- 1: auto sync saved it although it looked wrong next to the one before.
        ALTER TABLE snapshots ADD COLUMN review INTEGER NOT NULL DEFAULT 0;
        ",
    )?;
    Ok(())
}

/// Snapshots are rebuilt with AUTOINCREMENT: the page and the messages tell
/// rows apart by id, and a plain rowid hands a deleted newest row's id to the
/// next one.
fn add_sessions_and_batches(tx: &Transaction<'_>) -> Result<()> {
    tx.execute_batch(
        "
        CREATE TABLE snapshots_v4 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            raw BLOB,
            artifacts_4 INTEGER,
            artifacts_3 INTEGER,
            essence INTEGER,
            review INTEGER NOT NULL DEFAULT 0,
            -- Auto sync: the session's login snapshot id; NULL for imports.
            session INTEGER
        );
        INSERT INTO snapshots_v4 (id, taken_at, imported_at, format, source, uid, content_hash,
            characters, weapons, artifacts, materials, mora, primogems, raw, artifacts_4,
            artifacts_3, essence, review)
        SELECT id, taken_at, imported_at, format, source, uid, content_hash, characters,
            weapons, artifacts, materials, mora, primogems, raw, artifacts_4, artifacts_3,
            essence, review
        FROM snapshots;
        DROP TABLE snapshots;
        ALTER TABLE snapshots_v4 RENAME TO snapshots;
        CREATE INDEX snapshots_taken_at ON snapshots (taken_at);
        CREATE TABLE batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session INTEGER NOT NULL,
            -- The export's own timestamp (unix ms).
            at INTEGER NOT NULL,
            -- The summary and content hash of the export the batch leads to.
            characters INTEGER NOT NULL,
            weapons INTEGER NOT NULL,
            artifacts INTEGER NOT NULL,
            artifacts_4 INTEGER,
            artifacts_3 INTEGER,
            materials INTEGER NOT NULL,
            mora INTEGER,
            primogems INTEGER,
            essence INTEGER,
            content_hash BLOB NOT NULL,
            -- The changes, a JSON array, deflated.
            changes BLOB NOT NULL
        );
        CREATE INDEX batches_session ON batches (session, id);
        ",
    )?;
    Ok(())
}

const COLUMNS: &str = "id, taken_at, imported_at, source, uid, characters, weapons, artifacts, \
                       artifacts_4, artifacts_3, materials, mora, primogems, essence, \
                       raw IS NOT NULL, review, session";

/// A batch as a row of the list (`COLUMNS` in the same order), standing for
/// the export it leads to: with its login snapshot's source and account, and
/// an export while one it can be rebuilt from is kept.
const HEAD_COLUMNS: &str = "-b.id, b.at, b.at, s.source, s.uid, b.characters, b.weapons, \
                            b.artifacts, b.artifacts_4, b.artifacts_3, b.materials, b.mora, \
                            b.primogems, b.essence, \
                            EXISTS (SELECT 1 FROM snapshots k WHERE k.session = b.session \
                                AND k.raw IS NOT NULL AND k.taken_at <= b.at), \
                            0, b.session";

/// Whether snapshot `?1` is a login snapshot.
const IS_LOGIN: &str = "EXISTS (SELECT 1 FROM snapshots WHERE id = ?1 AND session = ?1)";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: i64,
    pub taken_at: i64,
    pub imported_at: i64,
    pub source: String,
    /// Tells accounts apart; the page shows it unless set to mask it.
    pub uid: Option<u64>,
    pub summary: Summary,
    /// Whether the original export is still kept.
    pub has_raw: bool,
    /// Saved by auto sync although it looked wrong next to its account's
    /// snapshot before it; the user keeps or deletes it.
    pub review: bool,
    /// The auto sync session: its login snapshot's id. `None` for imports.
    pub session: Option<i64>,
    /// The head row of the export auto sync holds right now. Never set
    /// here: only the app knows it.
    pub live: bool,
}

/// Which auto sync session a snapshot belongs to.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Session {
    /// It is a login's first: it starts a session, named by its own id.
    New,
    /// The session of this login snapshot.
    Of(i64),
}

/// What rebuilding a head row's export takes: a kept export of its session,
/// the batches after it up to the head in order, and when the result was
/// read and what it must hash to.
#[derive(Debug)]
pub struct RebuildParts {
    pub base: Vec<u8>,
    pub batches: Vec<Vec<u8>>,
    pub at: i64,
    pub content_hash: Vec<u8>,
}

/// One batch of a session's timeline.
#[derive(Debug)]
pub struct Batch {
    pub id: i64,
    pub at: i64,
    /// The changes, a JSON array, as stored.
    pub changes: Vec<u8>,
}

/// What to do with an export that looks wrong next to its account's snapshot
/// before it (fewer characters, a fifth fewer weapons or artifacts) or, for a
/// file (`Ask`), is of a new account.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Check {
    /// Save nothing; say why.
    Ask,
    /// Save it: the user confirmed.
    Confirmed,
    /// Save it marked for review: nobody was asked (auto sync).
    Mark,
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
        id: i64,
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
    /// unless the same content is stored already. One that looks wrong next
    /// to its account's snapshot before it, or is a file of a new account, is
    /// handled as `check` says. `session` is `None` for an import. A session
    /// whose login snapshot was deleted is over: the snapshot starts a new
    /// one (the saved row says which).
    pub fn import(
        &mut self,
        export: &Export,
        raw: &[u8],
        taken_at: i64,
        now: i64,
        check: Check,
        mut session: Option<Session>,
    ) -> Result<Outcome> {
        let existing = self
            .conn
            .query_row(
                "SELECT id, taken_at FROM snapshots WHERE content_hash = ?1",
                [&export.content_hash[..]],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if let Some((id, taken_at)) = existing {
            return Ok(Outcome::Duplicate { id, taken_at });
        }

        let summary = export.summary();
        let uid = export.uid();
        // Only a file asks: auto sync saves another account's login as it is.
        if check == Check::Ask
            && let Some(uid) = uid
            && self.conn.query_row(
                "SELECT EXISTS (SELECT 1 FROM snapshots WHERE uid IS NOT NULL)
                     AND NOT EXISTS (SELECT 1 FROM snapshots WHERE uid = ?1)",
                [uid],
                |row| row.get::<_, bool>(0),
            )?
        {
            return Ok(Outcome::NeedsConfirmation {
                warnings: vec![Warning::NewAccount],
            });
        }
        let mut review = false;
        if check != Check::Confirmed
            && let Some(previous) = self.latest_before(taken_at, uid)?
        {
            let warnings = account::warnings(&previous.summary, &summary);
            if !warnings.is_empty() {
                if check == Check::Ask {
                    return Ok(Outcome::NeedsConfirmation { warnings });
                }
                review = true;
            }
        }

        let compressed = compress(raw)?;
        let tx = self.conn.transaction()?;
        if let Some(Session::Of(login)) = session
            && !tx.query_row(&format!("SELECT {IS_LOGIN}"), [login], |row| {
                row.get::<_, bool>(0)
            })?
        {
            session = Some(Session::New);
        }
        // `format` is unused, but the column is NOT NULL.
        tx.execute(
            "INSERT INTO snapshots (taken_at, imported_at, format, source, uid, content_hash,
                 characters, weapons, artifacts, artifacts_4, artifacts_3, materials, mora,
                 primogems, essence, raw, review, session)
             VALUES (?1, ?2, 'leyline', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
                 ?16, ?17)",
            params![
                taken_at,
                now,
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
                review,
                match session {
                    Some(Session::Of(id)) => Some(id),
                    Some(Session::New) | None => None,
                },
            ],
        )?;
        let id = tx.last_insert_rowid();
        if session == Some(Session::New) {
            tx.execute("UPDATE snapshots SET session = id WHERE id = ?1", [id])?;
        }
        // Free pages are reused by later inserts, so the file stops growing
        // once it holds the newest exports. Only this account gained a row;
        // `IS` makes the rows without a UID one group.
        tx.execute(
            "UPDATE snapshots SET raw = NULL WHERE raw IS NOT NULL AND uid IS ?2 AND id NOT IN
                 (SELECT id FROM snapshots WHERE uid IS ?2 ORDER BY taken_at DESC, id DESC
                  LIMIT ?1)",
            params![FULL_SNAPSHOTS, uid],
        )?;
        tx.commit()?;
        let snapshot = self.conn.query_row(
            &format!("SELECT {COLUMNS} FROM snapshots WHERE id = ?1"),
            [id],
            snapshot,
        )?;
        Ok(Outcome::Saved { snapshot })
    }

    /// Every snapshot, and a head row (the batch's id, negated) for each
    /// session whose newest batch is newer than its newest snapshot: the
    /// export auto sync holds now, or held when it last stopped without
    /// saving one. Newest first.
    pub fn list(&self) -> Result<Vec<Snapshot>> {
        let mut statement = self
            .conn
            .prepare(&format!("SELECT {COLUMNS} FROM snapshots"))?;
        let mut list = statement
            .query_map([], snapshot)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut heads = self.conn.prepare(&format!(
            "WITH newest AS (
                 SELECT session, MAX(taken_at) AS taken_at FROM snapshots
                 WHERE session IS NOT NULL GROUP BY session
             )
             SELECT {HEAD_COLUMNS}
             FROM (SELECT MAX(id) AS id FROM batches GROUP BY session) AS last
             JOIN batches b ON b.id = last.id
             JOIN snapshots s ON s.id = b.session
             JOIN newest n ON n.session = b.session
             WHERE b.at > n.taken_at"
        ))?;
        for head in heads.query_map([], snapshot)? {
            list.push(head?);
        }
        list.sort_unstable_by_key(|row| std::cmp::Reverse((row.taken_at, row.id)));
        Ok(list)
    }

    /// Stores a batch of `session`'s changes (`changes`, their JSON) that
    /// leads to an export read at `at`, with `summary` and `content_hash`.
    /// Its id, or `None` when the session's login snapshot is gone.
    pub fn append_batch(
        &self,
        session: i64,
        at: i64,
        summary: &Summary,
        content_hash: &[u8; 32],
        changes: &[u8],
    ) -> Result<Option<i64>> {
        let inserted = self.conn.execute(
            &format!(
                "INSERT INTO batches (session, at, characters, weapons, artifacts, artifacts_4,
                     artifacts_3, materials, mora, primogems, essence, content_hash, changes)
                 SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
                 WHERE {IS_LOGIN}"
            ),
            params![
                session,
                at,
                summary.characters,
                summary.weapons,
                summary.artifacts,
                summary.artifacts4,
                summary.artifacts3,
                summary.materials,
                summary.mora,
                summary.primogems,
                summary.essence,
                &content_hash[..],
                compress(changes)?,
            ],
        )?;
        Ok((inserted > 0).then(|| self.conn.last_insert_rowid()))
    }

    /// A batch as its head row, whether or not the list shows it.
    pub fn head(&self, batch: i64) -> Result<Option<Snapshot>> {
        Ok(self
            .conn
            .query_row(
                &format!(
                    "SELECT {HEAD_COLUMNS} FROM batches b JOIN snapshots s ON s.id = b.session
                     WHERE b.id = ?1"
                ),
                [batch],
                snapshot,
            )
            .optional()?)
    }

    /// What rebuilding the export batch `batch` leads to takes; `None` when
    /// the batch is gone or its session kept no export from before it.
    ///
    /// Auto sync stores the batch leading to a snapshot, at the snapshot's
    /// time, before the snapshot itself; so the batches a snapshot does not
    /// hold are the later ones. Times decide this, not ids: after the clock
    /// stepped back within a session a head can find no base (`None`), or
    /// batches can be left out, which the checks on rebuilding then catch.
    pub fn rebuild_parts(&self, batch: i64) -> Result<Option<RebuildParts>> {
        let target = self
            .conn
            .query_row(
                "SELECT session, at, content_hash FROM batches WHERE id = ?1",
                [batch],
                |row| Ok((row.get::<_, i64>(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()?;
        let Some((session, at, content_hash)) = target else {
            return Ok(None);
        };
        let base = self
            .conn
            .query_row(
                "SELECT taken_at, raw FROM snapshots
                 WHERE session = ?1 AND raw IS NOT NULL AND taken_at <= ?2
                 ORDER BY taken_at DESC, id DESC LIMIT 1",
                params![session, at],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Vec<u8>>(1)?)),
            )
            .optional()?;
        let Some((base_at, base)) = base else {
            return Ok(None);
        };
        let mut select = self.conn.prepare(
            "SELECT changes FROM batches WHERE session = ?1 AND at > ?2 AND id <= ?3 ORDER BY id",
        )?;
        let compressed = select
            .query_map(params![session, base_at, batch], |row| {
                row.get::<_, Vec<u8>>(0)
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(Some(RebuildParts {
            base: decompress(&base)?,
            batches: compressed
                .iter()
                .map(|bytes| decompress(bytes))
                .collect::<Result<_>>()?,
            at,
            content_hash,
        }))
    }

    /// The batches of `session`, oldest first.
    pub fn timeline(&self, session: i64) -> Result<Vec<Batch>> {
        let mut select = self
            .conn
            .prepare("SELECT id, at, changes FROM batches WHERE session = ?1 ORDER BY id")?;
        let rows = select
            .query_map([session], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get::<_, Vec<u8>>(2)?))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows.into_iter()
            .map(|(id, at, compressed)| {
                Ok(Batch {
                    id,
                    at,
                    changes: decompress(&compressed)?,
                })
            })
            .collect()
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

    /// Keeps a snapshot marked for review: the mark goes.
    pub fn keep(&self, id: i64) -> Result<()> {
        self.conn
            .execute("UPDATE snapshots SET review = 0 WHERE id = ?1", [id])?;
        Ok(())
    }

    /// Deletes a snapshot. A login snapshot takes its session's batches
    /// with it: they were counted from it. The session's newest snapshot
    /// takes the batches later than the newest one left, which would
    /// otherwise show its state again.
    pub fn delete(&mut self, id: i64) -> Result<()> {
        let tx = self.conn.transaction()?;
        tx.execute(
            &format!("DELETE FROM batches WHERE session = ?1 AND {IS_LOGIN}"),
            [id],
        )?;
        tx.execute(
            "WITH target AS (SELECT session, taken_at FROM snapshots WHERE id = ?1),
                  kept AS (SELECT COALESCE(MAX(taken_at), -1) AS newest FROM snapshots
                           WHERE session = (SELECT session FROM target) AND id <> ?1)
             DELETE FROM batches
             WHERE session = (SELECT session FROM target)
               AND (SELECT taken_at FROM target) >= (SELECT newest FROM kept)
               AND at > (SELECT newest FROM kept)",
            [id],
        )?;
        tx.execute("DELETE FROM snapshots WHERE id = ?1", [id])?;
        tx.commit()?;
        Ok(())
    }

    /// Deletes an account: every snapshot of `uid` (of no account when
    /// `None`), the batches of their sessions, its wishes, and the settings
    /// `settings` names. How many snapshots went.
    pub fn delete_account(&mut self, uid: Option<u64>, settings: &[String]) -> Result<usize> {
        let tx = self.conn.transaction()?;
        tx.execute(
            "DELETE FROM batches WHERE session IN (SELECT id FROM snapshots WHERE uid IS ?1)",
            params![uid],
        )?;
        let gone = tx.execute("DELETE FROM snapshots WHERE uid IS ?1", params![uid])?;
        tx.execute("DELETE FROM wishes WHERE uid IS ?1", params![uid])?;
        for key in settings {
            tx.execute("DELETE FROM settings WHERE key = ?1", [key])?;
        }
        tx.commit()?;
        Ok(gone)
    }

    /// A setting's stored value; `None` until one is set.
    pub fn setting(&self, key: &str) -> Result<Option<String>> {
        Ok(self
            .conn
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
                row.get(0)
            })
            .optional()?)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            [key, value],
        )?;
        Ok(())
    }

    /// The newest snapshot at or before `taken_at` of the account `uid`; for
    /// an export without one, of any account.
    fn latest_before(&self, taken_at: i64, uid: Option<u64>) -> Result<Option<Snapshot>> {
        Ok(self
            .conn
            .query_row(
                &format!(
                    "SELECT {COLUMNS} FROM snapshots WHERE taken_at <= ?1
                         AND (?2 IS NULL OR uid = ?2)
                     ORDER BY taken_at DESC, id DESC LIMIT 1"
                ),
                params![taken_at, uid],
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
    Ok(Snapshot {
        id: row.get(0)?,
        taken_at: row.get(1)?,
        imported_at: row.get(2)?,
        source: row.get(3)?,
        uid: row.get(4)?,
        summary: Summary {
            characters: row.get(5)?,
            weapons: row.get(6)?,
            artifacts: row.get(7)?,
            artifacts4: row.get(8)?,
            artifacts3: row.get(9)?,
            materials: row.get(10)?,
            mora: row.get(11)?,
            primogems: row.get(12)?,
            essence: row.get(13)?,
        },
        has_raw: row.get(14)?,
        review: row.get(15)?,
        session: row.get(16)?,
        live: false,
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
