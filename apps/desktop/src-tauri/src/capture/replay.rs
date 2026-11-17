// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The regression test: a recorded login must decode to the same export
//! Teyvat.me Capture makes of it, and must leave no UID in the log.
//!
//! It needs a real login, so it is ignored unless asked for:
//!
//! ```text
//! cargo xtask pack
//! MOONGAZER_REGRESSION=<dir> cargo test --locked -p moongazer --features capture \
//!     -- --ignored --nocapture replay
//! ```
//!
//! `<dir>`, an absolute path, holds `login.pcapng` and `reference.json`,
//! Capture's own `--replay-export` of that recording. Both are account data:
//! they stay in the git-ignored `.temp/regression/`, and this test prints
//! counts and key paths only, never a value.

#![expect(clippy::print_stdout, reason = "the counts are the test's report")]

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde_json::Value;
use teyvatme_core::recording::{self, Recording};
use tracing_subscriber::fmt::MakeWriter;

use super::decoder::Decoder;
use super::pack::Pack;
use crate::logging;

#[test]
#[ignore = "needs a recorded login in $MOONGAZER_REGRESSION"]
fn a_recorded_login_decodes_to_the_export_capture_makes_of_it() {
    static LOG: Mutex<Vec<u8>> = Mutex::new(Vec::new());
    static UNFILTERED: Mutex<Vec<u8>> = Mutex::new(Vec::new());
    let logged = |log: &Mutex<Vec<u8>>| String::from_utf8_lossy(&log.lock().unwrap()).into_owned();

    let dir = PathBuf::from(
        std::env::var_os("MOONGAZER_REGRESSION").expect("MOONGAZER_REGRESSION names the folder"),
    );
    let pack = Pack::load(&Path::new(env!("CARGO_MANIFEST_DIR")).join("capture-pack")).unwrap();
    let mut decoder = Decoder::new(pack);

    let app_log = logging::subscriber(|| LOG.make_writer());
    let (frames, saved_at, ours) = tracing::subscriber::with_default(app_log, || {
        let (frames, saved_at) = replay(&dir.join("login.pcapng"), &mut decoder);
        let export = decoder.export(saved_at).unwrap();
        (frames, saved_at, export.expect("the login is whole"))
    });

    // The importer must read what the decoder writes. Its error can quote a
    // value from the export, so it is not shown.
    let Ok(imported) = account::parse(ours.as_bytes()) else {
        panic!("the importer does not read the export");
    };
    assert_eq!(imported.format, account::Format::Leyline);
    let summary = imported.summary();
    println!(
        "frames {frames}; characters {}, weapons {}, artifacts {}, materials {}",
        summary.characters, summary.weapons, summary.artifacts, summary.materials
    );

    let uid = imported.uid().expect("the export has a UID").to_string();
    // The same export logged without the filter, to know the check can see
    // a UID at all.
    let everything = tracing_subscriber::fmt()
        .with_writer(|| UNFILTERED.make_writer())
        .finish();
    tracing::subscriber::with_default(everything, || decoder.export(saved_at).unwrap());
    assert!(
        logged(&UNFILTERED).contains(&uid),
        "upstream no longer logs the UID here; the check below proves nothing"
    );
    let leaked = logged(&LOG).contains(&uid);
    println!("UID in the log: {}", if leaked { "yes" } else { "no" });
    assert!(!leaked, "the log holds the UID");

    let mut reference: Value =
        serde_json::from_slice(&fs::read(dir.join("reference.json")).unwrap()).unwrap();
    let ours: Value = serde_json::from_str(&ours).unwrap();
    // The two intended differences: who wrote the export, and which data
    // set its tables came from (upstream's own, or AnimeGameData's).
    reference["source"] = ours["source"].clone();
    reference["gi_player"]["gameData"] = ours["gi_player"]["gameData"].clone();
    let mut differing = BTreeMap::new();
    differences(
        String::new(),
        Some(&sorted(&ours)),
        Some(&sorted(&reference)),
        &mut differing,
    );
    for (path, count) in &differing {
        println!("differs at {path}: {count}");
    }
    assert!(differing.is_empty(), "the export differs from Capture's");
    println!("identical to the reference");
}

/// Feeds the decoder every frame of the recording. Returns how many there
/// were and when the last one with account data was seen, which is the save
/// time Capture's replay stamps on its export.
fn replay(path: &Path, decoder: &mut Decoder) -> (u64, u64) {
    let mut recording = Recording::open(path).unwrap();
    let (mut frames, mut last_data_ms) = (0, 0);
    while let Some(frame) = recording.next_frame().unwrap() {
        frames += 1;
        let at_ms = frame.timestamp_ns.expect("the recording has timestamps") / 1_000_000;
        if let Some(data) = recording::as_ethernet(frame.link_type, frame.data)
            && decoder.feed(data, at_ms)
        {
            last_data_ms = at_ms;
        }
    }
    (frames, last_data_ms)
}

/// `value` with object keys and array items in a fixed order: the upstream
/// model keeps entities in hash maps, so no two exports list them alike.
fn sorted(value: &Value) -> Value {
    match value {
        Value::Array(items) => {
            let mut items: Vec<Value> = items.iter().map(sorted).collect();
            items.sort_by_cached_key(Value::to_string);
            Value::Array(items)
        }
        Value::Object(map) => {
            let fields: BTreeMap<&String, Value> =
                map.iter().map(|(key, item)| (key, sorted(item))).collect();
            Value::Object(
                fields
                    .into_iter()
                    .map(|(key, item)| (key.clone(), item))
                    .collect(),
            )
        }
        other => other.clone(),
    }
}

/// Counts, by key path, the leaves at which two sorted values differ.
fn differences(
    path: String,
    ours: Option<&Value>,
    theirs: Option<&Value>,
    found: &mut BTreeMap<String, usize>,
) {
    match (ours, theirs) {
        (Some(Value::Object(a)), Some(Value::Object(b))) => {
            let keys: BTreeSet<&String> = a.keys().chain(b.keys()).collect();
            for key in keys {
                differences(format!("{path}.{key}"), a.get(key), b.get(key), found);
            }
        }
        (Some(Value::Array(a)), Some(Value::Array(b))) => {
            for index in 0..a.len().max(b.len()) {
                differences(format!("{path}[]"), a.get(index), b.get(index), found);
            }
        }
        (a, b) if a != b => *found.entry(path).or_default() += 1,
        _ => {}
    }
}
