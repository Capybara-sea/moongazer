// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

use super::*;

/// Synthetic GOOD v2 file without the v3 artifact fields.
const GOOD: &str = r#"{
  "format": "GOOD", "version": 2, "source": "Fake Exporter",
  "characters": [
    {"key": "FakeHero", "level": 90, "ascension": 6, "constellation": 1,
     "talent": {"auto": 1, "skill": 9, "burst": 10}},
    {"key": "TravelerAnemo", "level": 1, "ascension": 0, "constellation": 0,
     "talent": {"auto": 1, "skill": 1, "burst": 1}}
  ],
  "weapons": [
    {"key": "FakeBlade", "level": 1, "ascension": 0, "refinement": 1, "location": "", "lock": false},
    {"key": "FakeBlade", "level": 90, "ascension": 6, "refinement": 5, "location": "FakeHero", "lock": true}
  ],
  "artifacts": [
    {"setKey": "FakeSet", "slotKey": "flower", "level": 20, "rarity": 5, "mainStatKey": "hp",
     "location": "Traveler", "lock": true,
     "substats": [{"key": "critRate_", "value": 3.9}, {"key": "atk", "value": 19}]}
  ]
}"#;

/// Synthetic Leyline file: materials, both elixir spellings, `gi_player`.
fn leyline(uid: u64, timestamp: i64) -> String {
    format!(
        r#"{{
  "format": "GOOD", "version": 3, "source": "Teyvat.me", "leyline": 1, "timestamp": {timestamp},
  "characters": [],
  "weapons": [],
  "artifacts": [
    {{"setKey": "FakeSet", "slotKey": "plume", "level": 0, "rarity": 5, "mainStatKey": "atk",
     "location": "", "lock": false, "substats": [], "totalRolls": 3, "astralMark": true,
     "elixirCrafted": true, "unactivatedSubstats": [{{"key": "def", "value": 23, "initialValue": 23}}]}},
    {{"setKey": "OtherFakeSet", "slotKey": "sands", "level": 4, "rarity": 4, "mainStatKey": "atk_",
     "location": "", "lock": false, "substats": [], "elixerCrafted": true}}
  ],
  "materials": {{"Primogem": 160, "FakeOre": 0, "FakeHerb": 7}},
  "gi_player": {{"uid": {uid}, "ar": 60}}
}}"#
    )
}

fn parse_str(text: &str) -> Result<Export, ParseError> {
    parse(text.as_bytes())
}

#[test]
fn a_good_file_parses_without_v3_fields() {
    let export = parse_str(GOOD).unwrap();
    assert_eq!(export.format, Format::Good);
    assert_eq!(export.taken_at(), None);
    assert_eq!(export.uid(), None);
    assert_eq!(
        export.summary(),
        Summary {
            characters: 2,
            weapons: 2,
            artifacts: 1,
            artifacts4: Some(0),
            artifacts3: Some(0),
            materials: 0,
            mora: None,
            primogems: None,
            essence: None,
        }
    );
    let keys = export.keys();
    assert_eq!(keys.characters, ["FakeHero", "TravelerAnemo"]);
    assert_eq!(keys.weapons, ["FakeBlade"]);
    assert_eq!(keys.artifact_sets, ["FakeSet"]);
    assert!(keys.materials.is_empty());
}

#[test]
fn a_leyline_file_has_its_time_account_and_currencies() {
    let export = parse_str(&leyline(111_111_111, 1_700_000_000_000)).unwrap();
    assert_eq!(export.format, Format::Leyline);
    assert_eq!(export.taken_at(), Some(1_700_000_000_000));
    assert_eq!(export.uid(), Some(111_111_111));
    let summary = export.summary();
    // Zero counts are not materials; a missing Mora is 0 once materials exist.
    assert_eq!(summary.materials, 2);
    assert_eq!(summary.mora, Some(0));
    assert_eq!(summary.primogems, Some(160));
    assert_eq!(summary.essence, Some(0));
    assert_eq!((summary.artifacts4, summary.artifacts3), (Some(1), Some(0)));
    assert_eq!(export.keys().materials, ["FakeHerb", "Primogem"]);
}

#[test]
fn a_good_file_without_currencies_does_not_claim_zero() {
    let text = r#"{"format": "GOOD", "version": 2, "materials": {"FakeHerb": 7}}"#;
    let summary = parse_str(text).unwrap().summary();
    assert_eq!(
        (summary.mora, summary.primogems, summary.essence),
        (None, None, None)
    );
    assert_eq!(summary.materials, 1);
}

#[test]
fn artifacts_are_counted_by_rarity_and_essence_is_read() {
    let artifact = |rarity: u32| {
        format!(
            r#"{{"setKey": "FakeSet", "slotKey": "flower", "level": 0, "rarity": {rarity},
                "mainStatKey": "hp"}}"#
        )
    };
    let artifacts: Vec<String> = [5, 4, 4, 3, 3, 3, 1].map(artifact).into();
    let text = format!(
        r#"{{"format": "GOOD", "version": 2, "artifacts": [{}],
            "materials": {{"SanctifyingEssence": 42}}}}"#,
        artifacts.join(",")
    );
    let summary = parse_str(&text).unwrap().summary();
    assert_eq!(summary.artifacts, 7);
    assert_eq!((summary.artifacts4, summary.artifacts3), (Some(2), Some(3)));
    assert_eq!(summary.essence, Some(42));
}

#[test]
fn both_spellings_of_elixir_crafted_are_read() {
    let export = parse_str(&leyline(1, 1)).unwrap();
    assert!(export.data.artifacts.iter().all(|a| a.elixir_crafted));
    assert!(export.data.artifacts[0].astral_mark);
    assert_eq!(export.data.artifacts[0].unactivated_substats.len(), 1);
}

#[test]
fn an_old_capture_file_without_the_leyline_key_is_still_leyline() {
    let text = r#"{"format": "GOOD", "version": 3, "source": "Teyvat.me", "gi_player": {}}"#;
    assert_eq!(parse_str(text).unwrap().format, Format::Leyline);
}

#[test]
fn a_malformed_uid_counts_as_missing() {
    for uid in [r#""111111111""#, "-1", "1.5", "null"] {
        let text = format!(r#"{{"format": "GOOD", "version": 3, "gi_player": {{"uid": {uid}}}}}"#);
        assert_eq!(parse_str(&text).unwrap().uid(), None, "{uid}");
    }
}

#[test]
fn the_hash_ignores_key_and_array_order() {
    let a = r#"{"format":"GOOD","version":3,"weapons":[{"key":"A","level":1},{"key":"B","level":2}],"materials":{"X":1,"Y":2}}"#;
    let b = r#"{"materials":{"Y":2,"X":1},"weapons":[{"level":2,"key":"B"},{"level":1,"key":"A"}],"version":3,"format":"GOOD"}"#;
    let c = r#"{"format":"GOOD","version":3,"weapons":[{"key":"A","level":1},{"key":"B","level":3}],"materials":{"X":1,"Y":2}}"#;
    let hash = |text: &str| canonical::hash(&serde_json::from_str(text).unwrap());
    assert_eq!(hash(a), hash(b));
    assert_ne!(hash(a), hash(c));
}

#[test]
fn the_hash_tells_nesting_apart() {
    let hash = |text: &str| canonical::hash(&serde_json::from_str(text).unwrap());
    assert_ne!(hash(r#"[["a","b"]]"#), hash(r#"[["a"],["b"]]"#));
    assert_ne!(hash(r#"{"a":"b,c"}"#), hash(r#"{"a":"b","c":null}"#));
}

#[test]
fn files_that_are_not_good_are_rejected() {
    assert!(matches!(parse_str("not json"), Err(ParseError::Json(_))));
    assert!(matches!(
        parse_str(r#"{"format": "Other", "version": 3}"#),
        Err(ParseError::NotGood)
    ));
    assert!(matches!(
        parse_str(r#"{"format": "GOOD", "version": 4}"#),
        Err(ParseError::UnsupportedVersion(4))
    ));
    assert!(matches!(
        parse_str(r#"{"format": "GOOD"}"#),
        Err(ParseError::UnsupportedVersion(0))
    ));
}

#[test]
fn a_field_of_the_wrong_type_is_reported_with_its_position() {
    let text = "{\"format\": \"GOOD\", \"version\": 3,\n\"characters\": [{\"key\": 5}]}";
    let Err(ParseError::Json(err)) = parse_str(text) else {
        panic!("expected a JSON error");
    };
    assert_eq!(err.line(), 2);
}

fn summary(characters: u32, weapons: u32, artifacts: u32) -> Summary {
    Summary {
        characters,
        weapons,
        artifacts,
        ..Summary::default()
    }
}

#[test]
fn any_lost_character_needs_confirmation() {
    let warnings = warnings(&summary(50, 0, 0), None, &summary(49, 0, 0), None);
    assert_eq!(
        warnings,
        [Warning::Fewer {
            what: Category::Characters,
            before: 50,
            after: 49
        }]
    );
}

#[test]
fn weapons_and_artifacts_need_confirmation_only_past_a_fifth() {
    let before = summary(1, 100, 1000);
    assert!(warnings(&before, None, &summary(1, 80, 800), None).is_empty());
    let lost = warnings(&before, None, &summary(1, 79, 0), None);
    assert_eq!(lost.len(), 2);
    assert!(warnings(&before, None, &summary(2, 500, 5000), None).is_empty());
}

#[test]
fn another_account_needs_confirmation_when_both_files_name_one() {
    let s = summary(1, 1, 1);
    assert_eq!(warnings(&s, Some(1), &s, Some(2)), [Warning::OtherAccount]);
    assert!(warnings(&s, Some(1), &s, Some(1)).is_empty());
    assert!(warnings(&s, None, &s, Some(2)).is_empty());
    assert!(warnings(&s, Some(1), &s, None).is_empty());
}
