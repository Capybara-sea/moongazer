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
    format!(
        r#"{{"format": "GOOD", "version": 3, "source": "Teyvat.me", "leyline": 1,
            "timestamp": {n}, "characters": [{}], "weapons": [], "artifacts": [],
            "materials": {{"Mora": {n}, "Primogem": 1}}, "gi_player": {{"uid": {uid}}}}}"#,
        characters.join(",")
    )
}

fn import(db: &mut Db, text: &str, confirmed: bool) -> Outcome {
    let export = account::parse(text.as_bytes()).unwrap();
    let taken_at = export.taken_at().unwrap();
    db.import(&export, text.as_bytes(), taken_at, 0, confirmed)
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
    let snapshot = saved(import(&mut db, &text, false));
    assert_eq!(snapshot.taken_at, 1000);
    assert_eq!(snapshot.format, Format::Leyline);
    assert_eq!(snapshot.source, "Teyvat.me");
    assert_eq!(snapshot.uid, Some(111_111_111));
    assert_eq!(snapshot.summary.characters, 2);
    assert_eq!(snapshot.summary.mora, Some(1000));
    assert!(snapshot.has_raw);
    assert_eq!(db.raw(snapshot.id).unwrap().unwrap(), text.as_bytes());
    assert_eq!(db.list().unwrap().len(), 1);
}

#[test]
fn the_same_content_in_another_order_is_a_duplicate() {
    let mut db = Db::open_in_memory().unwrap();
    import(&mut db, &export_text(1000, 2, 1), false);
    let mut value: serde_json::Value = serde_json::from_str(&export_text(1000, 2, 1)).unwrap();
    value["characters"].as_array_mut().unwrap().reverse();
    let reordered = value.to_string();
    assert!(matches!(
        import(&mut db, &reordered, false),
        Outcome::Duplicate { taken_at: 1000 }
    ));
    assert_eq!(db.list().unwrap().len(), 1);
}

#[test]
fn a_drop_after_the_previous_snapshot_waits_for_confirmation() {
    let mut db = Db::open_in_memory().unwrap();
    import(&mut db, &export_text(1000, 3, 1), false);
    let fewer = export_text(2000, 1, 1);
    let Outcome::NeedsConfirmation { warnings } = import(&mut db, &fewer, false) else {
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
    saved(import(&mut db, &fewer, true));
    assert_eq!(db.list().unwrap().len(), 2);
}

#[test]
fn only_the_snapshot_just_before_counts() {
    let mut db = Db::open_in_memory().unwrap();
    import(&mut db, &export_text(1000, 1, 1), false);
    import(&mut db, &export_text(3000, 5, 1), false);
    // Older than the snapshot with five characters, newer than the one with one.
    saved(import(&mut db, &export_text(2000, 1, 1), false));
}

#[test]
fn another_account_waits_for_confirmation() {
    let mut db = Db::open_in_memory().unwrap();
    import(&mut db, &export_text(1000, 1, 1), false);
    let Outcome::NeedsConfirmation { warnings } = import(&mut db, &export_text(2000, 1, 2), false)
    else {
        panic!("expected a confirmation");
    };
    assert_eq!(warnings, [Warning::OtherAccount]);
}

#[test]
fn old_snapshots_keep_their_summary_but_not_their_export() {
    let mut db = Db::open_in_memory().unwrap();
    let total = i64::from(FULL_SNAPSHOTS) + 2;
    // Imported newest first, so the last two land at the old end.
    for n in (1..=total).rev() {
        saved(import(&mut db, &export_text(n, 1, 1), false));
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
        import(&mut db, &export_text(n, 1, 1), false);
    }
    let times: Vec<i64> = db.list().unwrap().iter().map(|s| s.taken_at).collect();
    assert_eq!(times, [3000, 2000, 1000]);
}

#[test]
fn the_uid_never_leaves_for_the_ui() {
    let mut db = Db::open_in_memory().unwrap();
    let snapshot = saved(import(&mut db, &export_text(1000, 1, 111_111_111), false));
    let json = serde_json::to_value(&snapshot).unwrap();
    assert!(json.get("uid").is_none());
    assert_eq!(json["summary"]["characters"], 1);
    assert_eq!(json["format"], "leyline");
}
