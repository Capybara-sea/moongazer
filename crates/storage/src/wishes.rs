// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Each account's wish history, kept for good: the game's history only goes
//! back about six months. Records come from UIGF files and from the game's
//! wish history API, and are told apart by their id, which the game gives.

use anyhow::Result;
use rusqlite::{Transaction, params};

use super::Db;

pub(super) fn create_wishes(tx: &Transaction<'_>) -> Result<()> {
    tx.execute_batch(
        "
        CREATE TABLE wishes (
            uid INTEGER NOT NULL,
            id INTEGER NOT NULL,
            -- The game's banner type: 100, 200, 301, 302, 400 or 500.
            gacha_type INTEGER NOT NULL,
            -- 0 when the source gave none.
            item_id INTEGER NOT NULL,
            -- As the source wrote them, in its language.
            name TEXT NOT NULL,
            item_type TEXT NOT NULL,
            rank INTEGER NOT NULL,
            -- Unix milliseconds.
            time INTEGER NOT NULL,
            PRIMARY KEY (uid, id)
        ) WITHOUT ROWID;
        ",
    )?;
    Ok(())
}

/// One wish.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Wish {
    pub id: u64,
    pub gacha_type: u32,
    pub item_id: u32,
    pub name: String,
    pub item_type: String,
    pub rank: u8,
    pub time: i64,
}

impl Db {
    /// The account's wishes, oldest first.
    pub fn wishes(&self, uid: u64) -> Result<Vec<Wish>> {
        let mut statement = self.conn.prepare(
            "SELECT id, gacha_type, item_id, name, item_type, rank, time
             FROM wishes WHERE uid = ?1 ORDER BY id",
        )?;
        let rows = statement.query_map([uid], |row| {
            Ok(Wish {
                id: row.get(0)?,
                gacha_type: row.get(1)?,
                item_id: row.get(2)?,
                name: row.get(3)?,
                item_type: row.get(4)?,
                rank: row.get(5)?,
                time: row.get(6)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    /// Adds the wishes not stored yet, in one transaction; how many were new.
    pub fn add_wishes(&mut self, uid: u64, wishes: &[Wish]) -> Result<usize> {
        let tx = self.conn.transaction()?;
        let mut added = 0;
        {
            let mut insert = tx.prepare(
                "INSERT OR IGNORE INTO wishes
                     (uid, id, gacha_type, item_id, name, item_type, rank, time)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            )?;
            for wish in wishes {
                added += insert.execute(params![
                    uid,
                    wish.id,
                    wish.gacha_type,
                    wish.item_id,
                    wish.name,
                    wish.item_type,
                    wish.rank,
                    wish.time
                ])?;
            }
        }
        tx.commit()?;
        Ok(added)
    }

    /// Whether the account has the wish `id` already.
    pub fn has_wish(&self, uid: u64, id: u64) -> Result<bool> {
        Ok(self.conn.query_row(
            "SELECT EXISTS (SELECT 1 FROM wishes WHERE uid = ?1 AND id = ?2)",
            params![uid, id],
            |row| row.get(0),
        )?)
    }

    /// How many wishes the account has.
    pub fn wish_count(&self, uid: u64) -> Result<usize> {
        Ok(self
            .conn
            .query_row("SELECT COUNT(*) FROM wishes WHERE uid = ?1", [uid], |row| {
                row.get(0)
            })?)
    }

    /// Fills in the item id of the account's wishes stored without one,
    /// where `id_of(item_type, name)` knows the item, in one transaction;
    /// how many it filled.
    pub fn fill_item_ids(
        &mut self,
        uid: u64,
        id_of: impl Fn(&str, &str) -> Option<u32>,
    ) -> Result<usize> {
        let tx = self.conn.transaction()?;
        let mut filled = 0;
        {
            let without: Vec<(u64, String, String)> = tx
                .prepare("SELECT id, item_type, name FROM wishes WHERE uid = ?1 AND item_id = 0")?
                .query_map([uid], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
                .collect::<rusqlite::Result<_>>()?;
            let mut update =
                tx.prepare("UPDATE wishes SET item_id = ?3 WHERE uid = ?1 AND id = ?2")?;
            for (id, item_type, name) in without {
                if let Some(item_id) = id_of(&item_type, &name) {
                    filled += update.execute(params![uid, id, item_id])?;
                }
            }
        }
        tx.commit()?;
        Ok(filled)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wish(id: u64, gacha_type: u32) -> Wish {
        Wish {
            id,
            gacha_type,
            item_id: 11_301,
            name: "Test Sword".to_owned(),
            item_type: "Weapon".to_owned(),
            rank: 3,
            time: 1_000 + i64::try_from(id).unwrap_or(0),
        }
    }

    #[test]
    fn wishes_are_added_once_and_read_back_oldest_first() {
        let mut db = Db::open_in_memory().unwrap();
        assert_eq!(db.add_wishes(1, &[wish(3, 301), wish(1, 200)]).unwrap(), 2);
        assert_eq!(db.add_wishes(1, &[wish(1, 200), wish(2, 302)]).unwrap(), 1);
        let ids: Vec<u64> = db.wishes(1).unwrap().iter().map(|w| w.id).collect();
        assert_eq!(ids, [1, 2, 3]);
        assert_eq!(db.wishes(1).unwrap()[0], wish(1, 200));
        assert!(db.has_wish(1, 2).unwrap());
        assert!(!db.has_wish(2, 2).unwrap());
        assert_eq!(db.wish_count(1).unwrap(), 3);
    }

    #[test]
    fn the_same_id_is_kept_per_account() {
        let mut db = Db::open_in_memory().unwrap();
        db.add_wishes(1, &[wish(7, 301)]).unwrap();
        assert_eq!(db.add_wishes(2, &[wish(7, 301)]).unwrap(), 1);
        assert_eq!(db.wish_count(2).unwrap(), 1);
    }

    #[test]
    fn item_ids_are_filled_in_where_known() {
        let mut db = Db::open_in_memory().unwrap();
        let without = |id, name: &str| Wish {
            item_id: 0,
            name: name.to_owned(),
            ..wish(id, 301)
        };
        db.add_wishes(
            1,
            &[without(1, "Known"), without(2, "Unknown"), wish(3, 301)],
        )
        .unwrap();
        db.add_wishes(2, &[without(1, "Known")]).unwrap();
        let id_of = |item_type: &str, name: &str| {
            (item_type == "Weapon" && name == "Known").then_some(11_302)
        };
        assert_eq!(db.fill_item_ids(1, id_of).unwrap(), 1);
        let ids: Vec<u32> = db.wishes(1).unwrap().iter().map(|w| w.item_id).collect();
        assert_eq!(ids, [11_302, 0, 11_301]);
        // Another account's are left alone, and filling again finds nothing.
        assert_eq!(db.wishes(2).unwrap()[0].item_id, 0);
        assert_eq!(db.fill_item_ids(1, id_of).unwrap(), 0);
    }

    #[test]
    fn a_record_id_beyond_i32_round_trips() {
        let mut db = Db::open_in_memory().unwrap();
        let id = 1_764_000_000_000_000_123;
        db.add_wishes(1, &[wish(id, 301)]).unwrap();
        assert_eq!(db.wishes(1).unwrap()[0].id, id);
    }
}
