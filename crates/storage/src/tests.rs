// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

use std::path::PathBuf;

use account::Category;

use super::*;

/// A synthetic Leyline file; `n` makes its content unique.
fn export_text(n: i64, characters: usize, uid: u64) -> String {
    let characters: Vec<String> = (0..characters)
        .map(|i| {
            format!(
                r#"{{"key": "Fake{i}", "level": 1, "ascension": 0, "constellation": 0,
                    "talent": {{"auto": 1, "skill": 1, "burst": 1}}}}"#
            )
        })
        .collect();
    let artifacts: Vec<String> = [4, 4, 3]
        .map(|rarity| {
            format!(
                r#"{{"setKey": "FakeSet", "slotKey": "flower", "level": 0, "rarity": {rarity},
                    "mainStatKey": "hp"}}"#
            )
        })
        .into();
    format!(
        r#"{{"format": "GOOD", "version": 3, "source": "Teyvat.me", "leyline": 1,
            "timestamp": {n}, "characters": [{}], "weapons": [], "artifacts": [{}],
            "materials": {{"Mora": {n}, "Primogem": 1, "SanctifyingEssence": 7}},
            "gi_player": {{"uid": {uid}}}}}"#,
        characters.join(","),
        artifacts.join(",")
    )
}

/// The same, of no account the importer can tell.
fn export_without_uid(n: i64, characters: usize) -> String {
    export_text(n, characters, 0).replace(r#"{"uid": 0}"#, "{}")
}

fn import(db: &mut Db, text: &str, check: Check) -> Outcome {
    import_into(db, text, check, None)
}

fn import_into(db: &mut Db, text: &str, check: Check, session: Option<Session>) -> Outcome {
    let export = account::parse(text.as_bytes()).unwrap();
    let taken_at = export.taken_at().unwrap();
    db.import(&export, text.as_bytes(), taken_at, 0, check, session)
        .unwrap()
}

fn saved(outcome: Outcome) -> Snapshot {
    match outcome {
        Outcome::Saved { snapshot } => snapshot,
        other => panic!("expected a saved snapshot, got {other:?}"),
    }
}

/// A fresh directory under the system temp dir, removed when dropped.
struct TempDir(PathBuf);

impl TempDir {
    fn new(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("moongazer-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn a_new_database_gets_the_latest_schema_once() {
    let dir = TempDir::new("schema");
    let path = dir.0.join("data").join("moongazer.db");
    drop(Db::open(&path).unwrap());
    let db = Db::open(&path).unwrap();
    let version: usize = db
        .conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, MIGRATIONS.len());
    let mode: String = db
        .conn
        .pragma_query_value(None, "journal_mode", |row| row.get(0))
        .unwrap();
    assert_eq!(mode, "wal");
}

#[test]
fn a_database_from_a_newer_app_is_refused() {
    let dir = TempDir::new("newer");
    let path = dir.0.join("moongazer.db");
    let conn = Connection::open(&path).unwrap();
    conn.pragma_update(None, "user_version", MIGRATIONS.len() + 1)
        .unwrap();
    drop(conn);
    assert!(Db::open(&path).is_err());
}

#[test]
fn an_import_is_saved_with_its_summary_and_export() {
    let mut db = Db::open_in_memory().unwrap();
    let text = export_text(1000, 2, 111_111_111);
    let snapshot = saved(import(&mut db, &text, Check::Ask));
    assert_eq!(snapshot.taken_at, 1000);
    assert_eq!(snapshot.source, "Teyvat.me");
    assert_eq!(snapshot.uid, Some(111_111_111));
    assert_eq!(snapshot.summary.characters, 2);
    assert_eq!(snapshot.summary.mora, Some(1000));
    assert!(snapshot.has_raw);
    assert_eq!(db.raw(snapshot.id).unwrap().unwrap(), text.as_bytes());
    let list = db.list().unwrap();
    assert_eq!(list.len(), 1);
    let summary = &list[0].summary;
    assert_eq!((summary.artifacts4, summary.artifacts3), (Some(2), Some(1)));
    assert_eq!(summary.essence, Some(7));
}

/// A database as the first version of the schema left it.
fn v1_database(path: &Path) -> Connection {
    let mut conn = Connection::open(path).unwrap();
    let tx = conn.transaction().unwrap();
    MIGRATIONS[0](&tx).unwrap();
    tx.pragma_update(None, "user_version", 1).unwrap();
    tx.commit().unwrap();
    conn
}

fn insert_v1(conn: &Connection, taken_at: i64, raw: Option<&[u8]>) {
    conn.execute(
        "INSERT INTO snapshots (taken_at, imported_at, format, source, uid, content_hash,
             characters, weapons, artifacts, materials, mora, primogems, raw)
         VALUES (?1, 0, 'leyline', 'Teyvat.me', 1, ?2, 1, 0, 3, 3, ?1, 1, ?3)",
        params![
            taken_at,
            taken_at.to_le_bytes(),
            raw.map(|raw| compress(raw).unwrap())
        ],
    )
    .unwrap();
}

#[test]
fn an_empty_v1_database_upgrades() {
    let dir = TempDir::new("v1-empty");
    let path = dir.0.join("moongazer.db");
    drop(v1_database(&path));
    let mut db = Db::open(&path).unwrap();
    let version: usize = db
        .conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, MIGRATIONS.len());
    assert!(db.list().unwrap().is_empty());
    saved(import(&mut db, &export_text(1000, 1, 1), Check::Ask));
}

#[test]
fn a_v1_database_gets_the_new_counts_from_the_exports_it_kept() {
    let dir = TempDir::new("v1-rows");
    let path = dir.0.join("moongazer.db");
    let conn = v1_database(&path);
    insert_v1(&conn, 1000, None);
    insert_v1(&conn, 2000, Some(export_text(2000, 1, 1).as_bytes()));
    insert_v1(&conn, 3000, Some(b"not json"));
    drop(conn);

    let db = Db::open(&path).unwrap();
    let list = db.list().unwrap();
    let times: Vec<i64> = list.iter().map(|s| s.taken_at).collect();
    assert_eq!(times, [3000, 2000, 1000]);
    let [unreadable, kept, dropped] = &list[..] else {
        panic!("expected three snapshots");
    };
    let summary = &kept.summary;
    assert_eq!((summary.artifacts4, summary.artifacts3), (Some(2), Some(1)));
    assert_eq!(summary.essence, Some(7));
    assert_eq!(summary.mora, Some(2000));
    for old in [unreadable, dropped] {
        let summary = &old.summary;
        assert_eq!(
            (summary.artifacts4, summary.artifacts3, summary.essence),
            (None, None, None)
        );
        assert_eq!(summary.artifacts, 3);
    }
    assert!(unreadable.has_raw && kept.has_raw && !dropped.has_raw);
}

#[test]
fn the_same_content_in_another_order_is_a_duplicate() {
    let mut db = Db::open_in_memory().unwrap();
    import(&mut db, &export_text(1000, 2, 1), Check::Ask);
    let mut value: serde_json::Value = serde_json::from_str(&export_text(1000, 2, 1)).unwrap();
    value["characters"].as_array_mut().unwrap().reverse();
    let reordered = value.to_string();
    let first = db.list().unwrap()[0].id;
    assert!(matches!(
        import(&mut db, &reordered, Check::Ask),
        Outcome::Duplicate { id, taken_at: 1000 } if id == first
    ));
    assert_eq!(db.list().unwrap().len(), 1);
}

#[test]
fn a_drop_after_the_previous_snapshot_waits_for_confirmation() {
    let mut db = Db::open_in_memory().unwrap();
    import(&mut db, &export_text(1000, 3, 1), Check::Ask);
    let fewer = export_text(2000, 1, 1);
    let Outcome::NeedsConfirmation { warnings } = import(&mut db, &fewer, Check::Ask) else {
        panic!("expected a confirmation");
    };
    assert_eq!(
        warnings,
        [Warning::Fewer {
            what: Category::Characters,
            before: 3,
            after: 1
        }]
    );
    assert_eq!(db.list().unwrap().len(), 1);
    saved(import(&mut db, &fewer, Check::Confirmed));
    assert_eq!(db.list().unwrap().len(), 2);
}

#[test]
fn only_the_snapshot_just_before_counts() {
    let mut db = Db::open_in_memory().unwrap();
    import(&mut db, &export_text(1000, 1, 1), Check::Ask);
    import(&mut db, &export_text(3000, 5, 1), Check::Ask);
    // Older than the snapshot with five characters, newer than the one with one.
    saved(import(&mut db, &export_text(2000, 1, 1), Check::Ask));
}

#[test]
fn each_account_is_compared_with_its_own_snapshot_before() {
    const A: u64 = 111_111_111;
    const B: u64 = 222_222_222;
    let mut db = Db::open_in_memory().unwrap();
    saved(import(&mut db, &export_text(1000, 3, A), Check::Ask));
    // Fewer characters than A's, but B's first: nothing to compare with.
    assert!(!saved(import(&mut db, &export_text(2000, 1, B), Check::Mark)).review);
    saved(import(&mut db, &export_text(3000, 5, B), Check::Ask));
    // Fewer than B's newest, as many as A's own.
    saved(import(&mut db, &export_text(4000, 3, A), Check::Ask));
    let Outcome::NeedsConfirmation { warnings } =
        import(&mut db, &export_text(5000, 0, B), Check::Ask)
    else {
        panic!("expected a confirmation");
    };
    assert_eq!(
        warnings,
        [Warning::Fewer {
            what: Category::Characters,
            before: 5,
            after: 0
        }]
    );
}

#[test]
fn an_export_without_a_uid_is_compared_with_the_newest_before_it() {
    let mut db = Db::open_in_memory().unwrap();
    saved(import(&mut db, &export_text(1000, 3, 1), Check::Ask));
    let fewer = export_without_uid(2000, 1);
    // Fewer characters, and no new account: a file without a UID names none.
    let Outcome::NeedsConfirmation { warnings } = import(&mut db, &fewer, Check::Ask) else {
        panic!("a drop asks first");
    };
    assert_eq!(
        warnings,
        [Warning::Fewer {
            what: Category::Characters,
            before: 3,
            after: 1
        }]
    );
    assert_eq!(saved(import(&mut db, &fewer, Check::Confirmed)).uid, None);
}

#[test]
fn a_file_of_a_new_account_asks_only_while_there_are_others() {
    const A: u64 = 111_111_111;
    const B: u64 = 222_222_222;
    const C: u64 = 333_333_333;
    let mut db = Db::open_in_memory().unwrap();
    // The first account is never asked about, nor a file without a UID.
    saved(import(&mut db, &export_without_uid(500, 1), Check::Ask));
    saved(import(&mut db, &export_text(1000, 1, A), Check::Ask));
    let b = export_text(2000, 1, B);
    let outcome = import(&mut db, &b, Check::Ask);
    assert_eq!(
        serde_json::to_value(&outcome).unwrap(),
        serde_json::json!({"status": "needsConfirmation", "warnings": [{"kind": "newAccount"}]})
    );
    assert_eq!(db.list().unwrap().len(), 2);
    saved(import(&mut db, &b, Check::Confirmed));
    saved(import(&mut db, &export_text(3000, 1, B), Check::Ask));
    // Auto sync saves a new account's login unmarked.
    assert!(!saved(import(&mut db, &export_text(4000, 1, C), Check::Mark)).review);
}

#[test]
fn each_account_keeps_the_export_of_its_newest_snapshots() {
    const A: u64 = 111_111_111;
    const B: u64 = 222_222_222;
    let mut db = Db::open_in_memory().unwrap();
    // B's only snapshot is older than all of A's.
    let b = saved(import(&mut db, &export_text(1, 1, B), Check::Ask));
    let full = i64::from(FULL_SNAPSHOTS);
    for n in 2..=full + 2 {
        saved(import(&mut db, &export_text(n, 1, A), Check::Confirmed));
        // Rows without a UID are trimmed as one group.
        saved(import(
            &mut db,
            &export_without_uid(1000 + n, 1),
            Check::Confirmed,
        ));
    }
    let list = db.list().unwrap();
    let kept = |uid: Option<u64>| list.iter().filter(move |s| s.uid == uid && s.has_raw);
    let count = |uid| kept(uid).count();
    let oldest = |uid| kept(uid).map(|s| s.taken_at).min();
    assert!(db.raw(b.id).unwrap().is_some());
    assert_eq!(count(Some(A)), usize::try_from(FULL_SNAPSHOTS).unwrap());
    assert_eq!(count(None), usize::try_from(FULL_SNAPSHOTS).unwrap());
    // The oldest of each lost its export.
    assert_eq!(oldest(Some(A)), Some(3));
    assert_eq!(oldest(None), Some(1003));
}

#[test]
fn old_snapshots_keep_their_summary_but_not_their_export() {
    let mut db = Db::open_in_memory().unwrap();
    let total = i64::from(FULL_SNAPSHOTS) + 2;
    // Imported newest first, so the last two land at the old end.
    for n in (1..=total).rev() {
        saved(import(&mut db, &export_text(n, 1, 1), Check::Ask));
    }
    let list = db.list().unwrap();
    assert_eq!(list.len(), usize::try_from(total).unwrap());
    let kept: Vec<_> = list.iter().filter(|s| s.has_raw).collect();
    assert_eq!(kept.len(), usize::try_from(FULL_SNAPSHOTS).unwrap());
    assert!(kept.iter().all(|s| s.taken_at > 2));
    let oldest = list.last().unwrap();
    assert_eq!(oldest.taken_at, 1);
    assert_eq!(oldest.summary.mora, Some(1));
    assert_eq!(db.raw(oldest.id).unwrap(), None);
}

#[test]
fn the_list_is_newest_first() {
    let mut db = Db::open_in_memory().unwrap();
    for n in [2000, 1000, 3000] {
        import(&mut db, &export_text(n, 1, 1), Check::Ask);
    }
    let times: Vec<i64> = db.list().unwrap().iter().map(|s| s.taken_at).collect();
    assert_eq!(times, [3000, 2000, 1000]);
}

#[test]
fn the_list_says_which_account_each_snapshot_is_of() {
    let mut db = Db::open_in_memory().unwrap();
    let snapshot = saved(import(
        &mut db,
        &export_text(1000, 1, 111_111_111),
        Check::Ask,
    ));
    let json = serde_json::to_value(&snapshot).unwrap();
    assert_eq!(json["uid"], 111_111_111);
    assert_eq!(json["summary"]["characters"], 1);
    assert!(json.get("format").is_none());
}

/// A database as the second version of the schema left it, with one row.
fn v2_database(path: &Path) {
    let mut conn = v1_database(path);
    insert_v1(&conn, 1000, Some(export_text(1000, 1, 1).as_bytes()));
    let tx = conn.transaction().unwrap();
    MIGRATIONS[1](&tx).unwrap();
    tx.pragma_update(None, "user_version", 2).unwrap();
    tx.commit().unwrap();
}

#[test]
fn a_v2_database_upgrades_with_its_rows_kept_and_none_to_review() {
    let dir = TempDir::new("v2-rows");
    let path = dir.0.join("moongazer.db");
    v2_database(&path);
    let mut db = Db::open(&path).unwrap();
    let list = db.list().unwrap();
    assert_eq!(list.len(), 1);
    assert!(!list[0].review);
    assert_eq!(db.setting("anything").unwrap(), None);
    saved(import(&mut db, &export_text(2000, 1, 1), Check::Ask));
}

#[test]
fn auto_sync_saves_a_drop_marked_for_review() {
    let mut db = Db::open_in_memory().unwrap();
    assert!(!saved(import(&mut db, &export_text(1000, 3, 1), Check::Mark)).review);
    let marked = saved(import(&mut db, &export_text(2000, 1, 1), Check::Mark));
    assert!(marked.review);
    db.keep(marked.id).unwrap();
    assert!(db.list().unwrap().iter().all(|snapshot| !snapshot.review));
    db.delete(marked.id).unwrap();
    assert_eq!(db.list().unwrap().len(), 1);
}

#[test]
fn a_setting_reads_back_what_was_set_last() {
    let db = Db::open_in_memory().unwrap();
    db.set_setting("sync.autoStart", "true").unwrap();
    db.set_setting("sync.autoStart", "false").unwrap();
    assert_eq!(
        db.setting("sync.autoStart").unwrap().as_deref(),
        Some("false")
    );
}

/// A database as schema `version` left it.
fn old_database(path: &Path, version: usize) -> Connection {
    let mut conn = Connection::open(path).unwrap();
    for (done, migration) in MIGRATIONS[..version].iter().enumerate() {
        let tx = conn.transaction().unwrap();
        migration(&tx).unwrap();
        tx.pragma_update(None, "user_version", done + 1).unwrap();
        tx.commit().unwrap();
    }
    conn
}

#[test]
fn a_v3_database_upgrades_empty_or_with_rows_outside_any_session() {
    for rows in [false, true] {
        let dir = TempDir::new(&format!("v3-{rows}"));
        let path = dir.0.join("moongazer.db");
        let conn = old_database(&path, 3);
        if rows {
            insert_v1(&conn, 1000, Some(export_text(1000, 1, 1).as_bytes()));
            insert_v1(&conn, 2000, None);
        }
        drop(conn);
        let mut db = Db::open(&path).unwrap();
        let list = db.list().unwrap();
        let ids: &[i64] = if rows { &[2, 1] } else { &[] };
        assert_eq!(list.iter().map(|s| s.id).collect::<Vec<_>>(), ids);
        assert!(list.iter().all(|s| s.session.is_none() && !s.live));
        let login = saved(import_into(
            &mut db,
            &export_text(3000, 1, 1),
            Check::Mark,
            Some(Session::New),
        ));
        assert_eq!(login.session, Some(login.id));
        let at_4000 = export_text(4000, 1, 1);
        assert!(append(&db, login.id, &export_text(3000, 1, 1), &at_4000).is_some());
    }
}

/// The changes from export `old` to `new`, as auto sync stores them.
fn changes(old: &str, new: &str) -> Vec<u8> {
    let value = |text: &str| account::parse(text.as_bytes()).unwrap().value;
    serde_json::to_vec(&account::delta::diff(&value(old), &value(new))).unwrap()
}

fn append(db: &Db, session: i64, old: &str, new: &str) -> Option<i64> {
    let export = account::parse(new.as_bytes()).unwrap();
    db.append_batch(
        session,
        export.taken_at().unwrap(),
        &export.summary(),
        &export.content_hash,
        &changes(old, new),
    )
    .unwrap()
}

/// A session as auto sync leaves it: a login snapshot at 1000, batches at
/// 2000 and 3000, a snapshot at 3000 (saved right after its batch), and a
/// batch at 4000. The exports and the batch ids.
fn session(db: &mut Db) -> (Snapshot, [String; 4], [i64; 3]) {
    let texts =
        [1000, 2000, 3000, 4000].map(|n| export_text(n, usize::try_from(n / 1000).unwrap(), 1));
    let login = saved(import_into(db, &texts[0], Check::Mark, Some(Session::New)));
    let b1 = append(db, login.id, &texts[0], &texts[1]).unwrap();
    let b2 = append(db, login.id, &texts[1], &texts[2]).unwrap();
    saved(import_into(
        db,
        &texts[2],
        Check::Mark,
        Some(Session::Of(login.id)),
    ));
    let b3 = append(db, login.id, &texts[2], &texts[3]).unwrap();
    (login, texts, [b1, b2, b3])
}

fn heads(db: &Db) -> Vec<Snapshot> {
    db.list()
        .unwrap()
        .into_iter()
        .filter(|s| s.id < 0)
        .collect()
}

#[test]
fn a_session_lists_its_newest_batch_only_while_it_is_newer_than_its_snapshots() {
    let mut db = Db::open_in_memory().unwrap();
    let text = |n: i64| export_text(n, 1, 7);
    let login = saved(import_into(
        &mut db,
        &text(1000),
        Check::Mark,
        Some(Session::New),
    ));
    assert!(heads(&db).is_empty());
    append(&db, login.id, &text(1000), &text(2000)).unwrap();
    let newest = append(&db, login.id, &text(2000), &text(3000)).unwrap();
    let list = db.list().unwrap();
    assert_eq!(
        list.iter().map(|s| s.taken_at).collect::<Vec<_>>(),
        [3000, 1000]
    );
    let head = &list[0];
    assert_eq!(head.id, -newest);
    assert_eq!((head.imported_at, head.session), (3000, Some(login.id)));
    assert_eq!((head.source.as_str(), head.uid), ("Teyvat.me", Some(7)));
    assert_eq!(head.summary.mora, Some(3000));
    assert!(head.has_raw && !head.review && !head.live);
    let head_json = serde_json::to_value(head).unwrap();
    assert_eq!(head_json["session"], login.id);
    assert_eq!(head_json["live"], false);

    // A snapshot at the batch's time holds it: no head.
    saved(import_into(
        &mut db,
        &text(3000),
        Check::Mark,
        Some(Session::Of(login.id)),
    ));
    assert!(heads(&db).is_empty());
    let later = append(&db, login.id, &text(3000), &text(4000)).unwrap();
    assert_eq!(
        heads(&db).iter().map(|s| s.id).collect::<Vec<_>>(),
        [-later]
    );
    assert_eq!(db.head(later).unwrap().unwrap().id, -later);
    // Manual imports start no session and list no head.
    saved(import(&mut db, &text(9000), Check::Confirmed));
    assert_eq!(heads(&db).len(), 1);
}

#[test]
fn a_head_is_rebuilt_from_the_newest_kept_snapshot_before_it() {
    let mut db = Db::open_in_memory().unwrap();
    let (login, texts, [b1, b2, b3]) = session(&mut db);
    for (batch, text, applied) in [(b1, &texts[1], 1), (b2, &texts[2], 0), (b3, &texts[3], 1)] {
        let parts = db.rebuild_parts(batch).unwrap().unwrap();
        assert_eq!(parts.batches.len(), applied, "batch {batch}");
        let expected = account::parse(text.as_bytes()).unwrap().content_hash;
        assert_eq!(parts.content_hash, expected);
        account::delta::rebuild(
            &parts.base,
            parts.batches.iter().map(Vec::as_slice),
            parts.at,
            &parts.content_hash,
        )
        .unwrap();
    }
    // Without the login's export, the first batch cannot be rebuilt.
    db.conn
        .execute("UPDATE snapshots SET raw = NULL WHERE id = ?1", [login.id])
        .unwrap();
    assert!(db.rebuild_parts(b1).unwrap().is_none());
    assert!(!db.head(b1).unwrap().unwrap().has_raw);
    assert!(db.head(b3).unwrap().unwrap().has_raw);
    assert!(db.rebuild_parts(b3 + 1).unwrap().is_none());
}

#[test]
fn a_timeline_is_the_sessions_batches_in_order() {
    let mut db = Db::open_in_memory().unwrap();
    let (login, texts, ids) = session(&mut db);
    let timeline = db.timeline(login.id).unwrap();
    assert_eq!(timeline.iter().map(|b| b.id).collect::<Vec<_>>(), ids);
    assert_eq!(
        timeline.iter().map(|b| b.at).collect::<Vec<_>>(),
        [2000, 3000, 4000]
    );
    assert_eq!(timeline[0].changes, changes(&texts[0], &texts[1]));
    assert!(db.timeline(login.id + 100).unwrap().is_empty());
}

#[test]
fn deleting_a_snapshot_takes_the_batches_past_the_newest_one_left() {
    let mut db = Db::open_in_memory().unwrap();
    let (login, texts, ids) = session(&mut db);
    let middle = db
        .list()
        .unwrap()
        .into_iter()
        .find(|s| s.id > 0 && s.id != login.id)
        .unwrap();
    let close = saved(import_into(
        &mut db,
        &texts[3],
        Check::Mark,
        Some(Session::Of(login.id)),
    ));
    let tail = append(&db, login.id, &texts[3], &export_text(5000, 5, 1)).unwrap();
    let batches = |db: &Db| {
        db.timeline(login.id)
            .unwrap()
            .iter()
            .map(|b| b.id)
            .collect::<Vec<_>>()
    };
    // Not the newest: the batches stay, the ones after a later snapshot too.
    db.delete(middle.id).unwrap();
    assert_eq!(batches(&db), [ids[0], ids[1], ids[2], tail]);
    // The newest goes with the batches past the newest one left.
    db.delete(close.id).unwrap();
    assert!(batches(&db).is_empty());
    assert!(heads(&db).is_empty());
}

#[test]
fn deleting_a_login_snapshot_takes_its_batches_and_stops_new_ones() {
    let mut db = Db::open_in_memory().unwrap();
    let (login, texts, _) = session(&mut db);
    db.delete(login.id).unwrap();
    assert!(db.timeline(login.id).unwrap().is_empty());
    assert!(db.list().unwrap().iter().all(|s| s.id > 0));
    assert_eq!(
        append(&db, login.id, &texts[3], &export_text(5000, 4, 1)),
        None
    );
    let count: i64 = db
        .conn
        .query_row("SELECT COUNT(*) FROM batches", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn a_deleted_snapshots_id_is_not_given_again() {
    let mut db = Db::open_in_memory().unwrap();
    let text = |n: i64| export_text(n, 1, 1);
    let login = saved(import_into(
        &mut db,
        &text(1000),
        Check::Mark,
        Some(Session::New),
    ));
    let batch = append(&db, login.id, &text(1000), &text(1500)).unwrap();
    db.delete(login.id).unwrap();
    let import = saved(import(&mut db, &text(2000), Check::Confirmed));
    assert_ne!(import.id, login.id);
    assert_eq!(append(&db, login.id, &text(2000), &text(3000)), None);
    let next = saved(import_into(
        &mut db,
        &text(4000),
        Check::Mark,
        Some(Session::New),
    ));
    assert!(append(&db, next.id, &text(4000), &text(5000)).unwrap() > batch);
}

#[test]
fn a_snapshot_of_a_session_whose_login_snapshot_was_deleted_starts_a_new_one() {
    let mut db = Db::open_in_memory().unwrap();
    let (login, texts, _) = session(&mut db);
    let kept = saved(import_into(
        &mut db,
        &export_text(5000, 4, 1),
        Check::Mark,
        Some(Session::Of(login.id)),
    ));
    assert_eq!(kept.session, Some(login.id));
    db.delete(login.id).unwrap();
    let next = saved(import_into(
        &mut db,
        &export_text(6000, 4, 1),
        Check::Mark,
        Some(Session::Of(login.id)),
    ));
    assert_eq!(next.session, Some(next.id));
    assert!(append(&db, next.id, &texts[3], &export_text(7000, 4, 1)).is_some());
}
