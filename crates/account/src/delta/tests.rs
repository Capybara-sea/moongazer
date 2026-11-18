// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

use serde_json::json;

use super::*;

/// A synthetic Leyline export with a bit of every shape: keyed lists,
/// nested objects, id objects and plain arrays.
fn export() -> Value {
    json!({
        "format": "GOOD", "version": 3, "source": "Moongazer", "leyline": 1,
        "timestamp": 1_000,
        "characters": [
            {"key": "FakeHero", "level": 80, "ascension": 5, "constellation": 0,
             "talent": {"auto": 1, "skill": 6, "burst": 9}},
            {"key": "FakeFriend", "level": 1, "ascension": 0, "constellation": 0,
             "talent": {"auto": 1, "skill": 1, "burst": 1}}
        ],
        "weapons": [
            {"key": "FakeBlade", "level": 80, "ascension": 5, "refinement": 1,
             "location": "FakeHero", "lock": true, "gi_guid": "101"},
            {"key": "FakeBow", "level": 1, "ascension": 0, "refinement": 1,
             "location": "", "lock": false, "gi_guid": "102"}
        ],
        "artifacts": [
            {"setKey": "FakeSet", "slotKey": "flower", "level": 16, "rarity": 5,
             "mainStatKey": "hp", "location": "FakeHero", "lock": true, "gi_guid": "201",
             "substats": [{"key": "atk", "value": 19, "initialValue": 19},
                          {"key": "critRate_", "value": 3.9, "initialValue": 3.9}]},
            {"setKey": "OtherFakeSet", "slotKey": "plume", "level": 0, "rarity": 4,
             "mainStatKey": "atk", "location": "", "lock": false, "gi_guid": "202",
             "substats": []}
        ],
        "materials": {"Mora": 1_000, "Primogem": 160, "FakeOre": 3},
        "gi_player": {"uid": 111_111_111, "ar": 55, "nickname": "Fake"},
        "gi_achievements": [81_001, 81_000],
        "gi_achievement_times": {"81000": 1_700_000_000},
        "gi_tasks": {"resin": {"value": 120, "nextAt": 1_700_000_100}}
    })
}

/// `export()` some play later: levels, a new artifact, one eaten, Mora
/// spent, an achievement, a substat rolled, and everything listed in
/// another order.
fn played() -> Value {
    json!({
        "format": "GOOD", "version": 3, "source": "Moongazer", "leyline": 1,
        "timestamp": 2_000,
        "characters": [
            {"key": "FakeFriend", "level": 1, "ascension": 0, "constellation": 0,
             "talent": {"auto": 1, "skill": 1, "burst": 1}},
            {"key": "FakeHero", "level": 80, "ascension": 5, "constellation": 0,
             "talent": {"auto": 1, "skill": 6, "burst": 10}},
            {"key": "FakeNewcomer", "level": 1, "ascension": 0, "constellation": 0,
             "talent": {"auto": 1, "skill": 1, "burst": 1}}
        ],
        "weapons": [
            {"key": "FakeBow", "level": 1, "ascension": 0, "refinement": 1,
             "location": "", "lock": false, "gi_guid": "102"},
            {"key": "FakeBlade", "level": 90, "ascension": 6, "refinement": 1,
             "location": "FakeHero", "lock": true, "gi_guid": "101"}
        ],
        "artifacts": [
            {"setKey": "FakeSet", "slotKey": "flower", "level": 20, "rarity": 5,
             "mainStatKey": "hp", "location": "FakeHero", "lock": true, "gi_guid": "201",
             "substats": [{"key": "critRate_", "value": 3.9, "initialValue": 3.9},
                          {"key": "atk", "value": 37, "initialValue": 19}]},
            {"setKey": "FakeSet", "slotKey": "goblet", "level": 0, "rarity": 5,
             "mainStatKey": "pyro_dmg_", "location": "", "lock": false, "gi_guid": "203",
             "substats": [{"key": "def", "value": 23, "initialValue": 23}]}
        ],
        "materials": {"Primogem": 160, "Mora": 400, "FakeHerb": 7},
        "gi_player": {"nickname": "Fake", "ar": 55, "uid": 111_111_111},
        "gi_achievements": [81_000, 81_001, 81_002],
        "gi_achievement_times": {"81000": 1_700_000_000, "81002": 1_700_000_500},
        "gi_tasks": {"resin": {"value": 100, "nextAt": 1_700_000_100}}
    })
}

fn find<'a>(changes: &'a [Change], path: &[&str]) -> &'a Change {
    changes
        .iter()
        .find(|change| change.path == path)
        .unwrap_or_else(|| panic!("no change at {path:?}"))
}

fn paths(changes: &[Change]) -> Vec<String> {
    changes.iter().map(|change| change.path.join(".")).collect()
}

#[test]
fn applying_the_changes_rebuilds_the_newer_export() {
    let (old, new) = (export(), played());
    let mut doc = old.clone();
    apply(&mut doc, &diff(&old, &new)).unwrap();
    doc["timestamp"] = new["timestamp"].clone();
    assert_eq!(canonical::hash(&doc), canonical::hash(&new));
}

#[test]
fn a_chain_of_batches_rebuilds_from_bytes_and_checks_the_hash() {
    let (first, second) = (export(), played());
    let mut third = second.clone();
    third["timestamp"] = json!(3_000);
    third["materials"]["Mora"] = json!(50);
    third["weapons"].as_array_mut().unwrap().pop();
    let batches: Vec<Vec<u8>> = [(&first, &second), (&second, &third)]
        .map(|(old, new)| serde_json::to_vec(&diff(old, new)).unwrap())
        .into();
    let base = serde_json::to_vec(&first).unwrap();
    let expected = canonical::hash(&third);
    let text = rebuild(&base, batches.iter().map(Vec::as_slice), 3_000, &expected).unwrap();
    let doc: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(canonical::hash(&doc), expected);

    let wrong = canonical::hash(&second);
    let result = rebuild(&base, batches.iter().map(Vec::as_slice), 3_000, &wrong);
    assert_eq!(result, Err(RebuildError::Hash));
    let result = rebuild(&base, [&b"not json"[..]], 3_000, &expected);
    assert_eq!(result, Err(RebuildError::Json));
}

#[test]
fn items_are_paired_by_their_key_and_named_on_weapon_and_artifact_changes() {
    let changes = diff(&export(), &played());
    let burst = find(&changes, &["characters", "FakeHero", "talent", "burst"]);
    assert_eq!(
        (&burst.before, &burst.after),
        (&Some(json!(9)), &Some(json!(10)))
    );
    assert_eq!(burst.key, None);

    let level = find(&changes, &["weapons", "101", "level"]);
    assert_eq!(
        (&level.before, &level.after),
        (&Some(json!(80)), &Some(json!(90)))
    );
    assert_eq!(level.key.as_deref(), Some("FakeBlade"));
    let rolled = find(&changes, &["artifacts", "201", "substats"]);
    assert_eq!(rolled.key.as_deref(), Some("FakeSet"));

    // Whole items carry themselves and no name.
    let added = find(&changes, &["artifacts", "203"]);
    assert_eq!(added.before, None);
    assert_eq!(added.after.as_ref().unwrap()["slotKey"], "goblet");
    assert_eq!(added.key, None);
    let eaten = find(&changes, &["artifacts", "202"]);
    assert_eq!((eaten.after.is_none(), eaten.key.is_none()), (true, true));
    assert!(
        find(&changes, &["characters", "FakeNewcomer"])
            .before
            .is_none()
    );

    // Objects are compared field by field, any other array as one value.
    find(&changes, &["materials", "Mora"]);
    assert!(find(&changes, &["materials", "FakeOre"]).after.is_none());
    find(&changes, &["gi_achievement_times", "81002"]);
    find(&changes, &["gi_achievements"]);
    find(&changes, &["gi_tasks", "resin", "value"]);
    assert_eq!(changes.len(), 14, "{:?}", paths(&changes));
}

#[test]
fn a_reorder_or_a_new_timestamp_is_no_change() {
    let old = export();
    let mut new = old.clone();
    new["timestamp"] = json!(5_000);
    for list in ["characters", "weapons", "artifacts", "gi_achievements"] {
        new[list].as_array_mut().unwrap().reverse();
    }
    new["artifacts"][1]["substats"]
        .as_array_mut()
        .unwrap()
        .reverse();
    assert!(diff(&old, &new).is_empty());
}

#[test]
fn a_list_with_a_missing_or_shared_key_is_one_value() {
    let old = export();
    let mut missing = old.clone();
    missing["weapons"][1]
        .as_object_mut()
        .unwrap()
        .remove("gi_guid");
    let mut shared = old.clone();
    shared["artifacts"][1]["gi_guid"] = json!("201");
    shared["artifacts"][1]["level"] = json!(4);
    for (new, list) in [(&missing, "weapons"), (&shared, "artifacts")] {
        let changes = diff(&old, new);
        assert_eq!(paths(&changes), [list]);
        let mut doc = old.clone();
        apply(&mut doc, &changes).unwrap();
        assert_eq!(canonical::hash(&doc), canonical::hash(new));
        // Back from the unkeyed list to the keyed one, too.
        let mut back = new.clone();
        apply(&mut back, &diff(new, &old)).unwrap();
        assert_eq!(canonical::hash(&back), canonical::hash(&old));
    }
}

#[test]
fn a_change_that_does_not_fit_the_document_is_refused() {
    let changes = diff(&export(), &played());
    let mut other = export();
    other["weapons"][0]["level"] = json!(70);
    assert_eq!(apply(&mut other, &changes), Err(ApplyError::Before));

    let stray = Change {
        path: ["gi_missing", "x"].map(str::to_owned).into(),
        before: None,
        after: Some(json!(1)),
        key: None,
    };
    assert_eq!(apply(&mut export(), &[stray]), Err(ApplyError::Path));
    let into_a_plain_list = Change {
        path: ["gi_achievements", "0"].map(str::to_owned).into(),
        before: Some(json!(81_000)),
        after: None,
        key: None,
    };
    assert_eq!(
        apply(&mut export(), &[into_a_plain_list]),
        Err(ApplyError::Path)
    );
}

#[test]
fn a_null_stays_a_null_and_absent_stays_absent() {
    let old = json!({"x": null, "y": 1});
    let new = json!({"y": null, "z": null});
    let changes = diff(&old, &new);
    let text = serde_json::to_string(&changes).unwrap();
    assert_eq!(
        text,
        r#"[{"p":["x"],"b":null},{"p":["y"],"b":1,"a":null},{"p":["z"],"a":null}]"#
    );
    let read: Vec<Change> = serde_json::from_str(&text).unwrap();
    assert_eq!(read, changes);
    let mut doc = old.clone();
    apply(&mut doc, &read).unwrap();
    assert_eq!(doc, new);
    // A null is not an absent value: applying the removal twice fails.
    assert_eq!(apply(&mut doc, &read[..1]), Err(ApplyError::Before));
}

#[test]
fn a_change_is_written_with_short_names() {
    let changes = diff(&export(), &played());
    let level = find(&changes, &["weapons", "101", "level"]);
    assert_eq!(
        serde_json::to_string(level).unwrap(),
        r#"{"p":["weapons","101","level"],"b":80,"a":90,"k":"FakeBlade"}"#
    );
}
