// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The regression test: a recorded login must decode to the same export
//! Teyvat.me Capture makes of it, but for the anecdotes recorded while
//! playing and the commissions the progress notify told, and must leave no
//! UID in the log.
//!
//! It needs a real login, so it is ignored unless asked for:
//!
//! ```text
//! cargo xtask pack
//! MOONGAZER_REGRESSION=<dir> cargo test --locked -p moongazer --features capture \
//!     -- --ignored --nocapture replay
//! ```
//!
//! `<dir>`, an absolute path, holds one folder per recording (or is one):
//! `login.pcapng`, recorded from before the game starts, and
//! `reference.json`, Capture's own `--replay-export` of it. Both are account
//! data: they stay in the git-ignored `.temp/regression/`, and these tests
//! print counts and key paths only, never a value.

#![expect(clippy::print_stdout, reason = "the counts are the test's report")]

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use account::delta;
use serde_json::Value;
use teyvatme_core::recording::{self, Recording};
use teyvatme_protocol::KeyState;
use tracing_subscriber::fmt::MakeWriter;

use super::decoder::{Decoder, TRAVELER_KEY};
use super::pack::Pack;
use super::service::LOGIN_BURST_FRAMES;
use super::worker::Burst;
use crate::logging;

/// The recordings under `$MOONGAZER_REGRESSION`: the folder itself when it
/// holds a `login.pcapng`, else each folder in it that does, by name.
fn recordings() -> Vec<PathBuf> {
    let dir = PathBuf::from(
        std::env::var_os("MOONGAZER_REGRESSION").expect("MOONGAZER_REGRESSION names the folder"),
    );
    if dir.join("login.pcapng").is_file() {
        return vec![dir];
    }
    let mut found: Vec<PathBuf> = fs::read_dir(&dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.join("login.pcapng").is_file())
        .collect();
    found.sort();
    assert!(!found.is_empty(), "no recording in $MOONGAZER_REGRESSION");
    found
}

fn name_of(dir: &Path) -> String {
    dir.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}

#[test]
#[ignore = "needs a recorded login in $MOONGAZER_REGRESSION"]
fn a_recorded_login_decodes_to_the_export_capture_makes_of_it() {
    let failed: Vec<String> = recordings()
        .iter()
        .filter(|dir| !matches_the_reference(dir))
        .map(|dir| name_of(dir))
        .collect();
    assert!(
        failed.is_empty(),
        "differs from Capture's export: {failed:?}"
    );
}

/// A real login clears the "no key" threshold however the burst windows fall,
/// and the frames before it (the title screen) do not.
#[test]
#[ignore = "needs a recorded login in $MOONGAZER_REGRESSION"]
fn a_recorded_login_is_a_burst_and_the_title_screen_is_not() {
    for dir in recordings() {
        let pack = Pack::built_in().unwrap();
        let mut decoder = Decoder::new(pack);
        let mut recording = Recording::open(&dir.join("login.pcapng")).unwrap();
        let mut burst = Burst::default();
        let mut before_key = 0;
        while let Some(frame) = recording.next_frame().unwrap() {
            let at_ms = frame.timestamp_ns.expect("the recording has timestamps") / 1_000_000;
            let Some(data) = recording::as_ethernet(frame.link_type, frame.data) else {
                continue;
            };
            decoder.feed(data, at_ms);
            let most = burst.on_frame(at_ms, decoder.received_since_reset());
            if decoder.key().state == KeyState::None {
                before_key = most;
            }
        }
        let name = name_of(&dir);
        println!(
            "{name}: busiest window {} frames, {before_key} before any key",
            burst.most()
        );
        assert!(burst.most() >= LOGIN_BURST_FRAMES, "{name}");
        assert!(before_key < LOGIN_BURST_FRAMES, "{name}");
    }
}

/// Replays one recording and compares its export with Capture's; false when
/// they differ beyond what is intended.
fn matches_the_reference(dir: &Path) -> bool {
    static LOG: Mutex<Vec<u8>> = Mutex::new(Vec::new());
    static UNFILTERED: Mutex<Vec<u8>> = Mutex::new(Vec::new());
    let logged = |log: &Mutex<Vec<u8>>| String::from_utf8_lossy(&log.lock().unwrap()).into_owned();
    LOG.lock().unwrap().clear();
    UNFILTERED.lock().unwrap().clear();
    println!("== {}", name_of(dir));

    let pack = Pack::built_in().unwrap();
    let mut decoder = Decoder::new(pack);

    let app_log = logging::subscriber(|| LOG.make_writer());
    let (frames, saved_at, ours) = tracing::subscriber::with_default(app_log, || {
        let (frames, saved_at) = replay(&dir.join("login.pcapng"), &mut decoder);
        let export = decoder.export(saved_at).unwrap();
        (frames, saved_at, export.expect("the login is whole").json)
    });

    // The importer must read what the decoder writes. Its error can quote a
    // value from the export, so it is not shown.
    let Ok(imported) = account::parse(ours.as_bytes()) else {
        panic!("the importer does not read the export");
    };
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
    // The intended differences: who wrote the export, which data set its
    // tables came from (upstream's own, or AnimeGameData's), and the
    // anecdotes recorded while playing, which Capture does not follow (see
    // anecdotes.rs).
    reference["source"] = ours["source"].clone();
    reference["gi_player"]["gameData"] = ours["gi_player"]["gameData"].clone();
    // Which twin the Traveler is, which only Moongazer writes.
    let twin = &ours[TRAVELER_KEY];
    println!(
        "Traveler's twin read: {}",
        if twin.is_u64() { "yes" } else { "no" }
    );
    assert!(twin.is_u64(), "the Traveler's twin was not read");
    reference[TRAVELER_KEY] = twin.clone();
    let mut differing = BTreeMap::new();
    differences(
        String::new(),
        Some(&sorted(&ours)),
        Some(&sorted(&reference)),
        &mut differing,
    );
    let live = differing.len();
    differing.retain(|path, _| !moved_while_playing(path));
    println!(
        "anecdote fields moved while playing: {}",
        live - differing.len()
    );
    let kept = differing.len();
    differing.retain(|path, _| !kept_from_an_earlier_list(path, &reference));
    println!(
        "respawn spots kept from an earlier list: {}",
        kept - differing.len()
    );
    let counted = differing.len();
    differing.retain(|path, _| !told_by_the_progress_notify(path, &ours, &reference));
    println!(
        "commission fields told by the progress notify: {}",
        counted - differing.len()
    );
    for (path, count) in &differing {
        println!("differs at {path}: {count}");
    }
    if differing.is_empty() {
        println!("identical to the reference otherwise");
    }
    differing.is_empty()
}

/// What a recorded anecdote moves: its state and finish count, and the
/// reward track.
fn moved_while_playing(path: &str) -> bool {
    let entry = path
        .strip_prefix(".gi_anecdotes.anecdotes.")
        .is_some_and(|rest| rest.ends_with(".state") || rest.ends_with(".finishCount"));
    entry
        || [
            ".gi_anecdotes.reward.index",
            ".gi_anecdotes.reward.progress",
        ]
        .contains(&path)
}

/// A respawn spot only we hold. When the game re-sends part of the list,
/// upstream since 1.18.4 keeps the spots it leaves out, which the reference's
/// Capture (1.17.32) dropped. Remove once the references come from 1.18.4 or
/// later.
fn kept_from_an_earlier_list(path: &str, reference: &Value) -> bool {
    path.strip_prefix(".gi_tasks.respawns.")
        .filter(|spot| !spot.contains(['.', '[']))
        .is_some_and(|spot| reference["gi_tasks"]["respawns"].get(spot).is_none())
}

/// What the day's progress notify told and the reference's Capture had not
/// learned to believe (see `Progress` in commissions.rs): more commissions
/// done, or Katheryne's reward taken.
fn told_by_the_progress_notify(path: &str, ours: &Value, reference: &Value) -> bool {
    let ours = &ours["gi_tasks"]["commissions"];
    let reference = &reference["gi_tasks"]["commissions"];
    match path {
        ".gi_tasks.commissions.finished" => {
            ours["finished"].as_u64() > reference["finished"].as_u64()
        }
        ".gi_tasks.commissions.claimed" => ours["claimed"] == true,
        _ => false,
    }
}

/// The chain test's step: after each export it skips 1/`CHAIN_POINTS` of the
/// frames still left, so it makes more exports than this.
const CHAIN_POINTS: u64 = 12;

/// Auto sync keeps a login's first export whole and each later one as the
/// changes since the one before. Applied in order onto the first, they must
/// rebuild every later export exactly, through the same JSON they are
/// stored as.
#[test]
#[ignore = "needs a recorded login in $MOONGAZER_REGRESSION"]
fn a_chain_of_batches_rebuilds_every_export_along_the_recording() {
    for dir in recordings() {
        println!("== {}", name_of(&dir));
        chain_rebuilds_every_export(&dir.join("login.pcapng"));
    }
}

fn chain_rebuilds_every_export(path: &Path) {
    let pack = Pack::built_in().unwrap();
    let mut decoder = Decoder::new(pack);

    let mut total = 0;
    let mut recording = Recording::open(path).unwrap();
    while recording.next_frame().unwrap().is_some() {
        total += 1;
    }
    let mut chain = Chain::default();
    let (mut frames, mut next_at, mut last_ms) = (0, None, 0);
    let mut recording = Recording::open(path).unwrap();
    while let Some(frame) = recording.next_frame().unwrap() {
        frames += 1;
        let at_ms = frame.timestamp_ns.expect("the recording has timestamps") / 1_000_000;
        last_ms = at_ms;
        let Some(data) = recording::as_ethernet(frame.link_type, frame.data) else {
            continue;
        };
        let fed = decoder.feed(data, at_ms);
        let login = decoder.login_parts();
        // From when a settle could start: the bag and the characters are in.
        if fed.data && login.items && login.characters && next_at.is_none_or(|at| frames >= at) {
            next_at = Some(frames + (total - frames) / CHAIN_POINTS + 1);
            chain.add(
                &decoder
                    .export(at_ms)
                    .unwrap()
                    .expect("the login is whole")
                    .json,
            );
        }
    }
    chain.add(&decoder.export(last_ms).unwrap().unwrap().json);
    // The same account later: only the timestamp differs, which is no change.
    let again = account::parse(
        decoder
            .export(last_ms + 60_000)
            .unwrap()
            .unwrap()
            .json
            .as_bytes(),
    );
    let Ok(again) = again else {
        panic!("the importer does not read the export");
    };
    let still = delta::diff(chain.previous.as_ref().unwrap(), &again.value);
    let mut sections = BTreeMap::<&str, usize>::new();
    for change in &still {
        *sections.entry(&change.path[0]).or_default() += 1;
    }
    println!(
        "chain: {} exports, {} changes, at most {} changes and {} bytes in a batch; \
         a minute later {} more {sections:?}",
        chain.exports,
        chain.changes,
        chain.most,
        chain.largest,
        still.len()
    );
    assert!(
        chain.exports > 2,
        "the recording gave too few exports to check"
    );
    // Weapons and artifacts pair by `gi_guid`: one fewer of each is one
    // change each, not the whole lists.
    let mut fewer = again.value.clone();
    for list in ["weapons", "artifacts"] {
        fewer[list].as_array_mut().unwrap().pop();
    }
    let removed: Vec<usize> = delta::diff(&again.value, &fewer)
        .iter()
        .map(|change| change.path.len())
        .collect();
    assert_eq!(removed, [2, 2], "items are not paired by their guid");
}

/// The exports so far: the first whole, the rest as batches.
#[derive(Default)]
struct Chain {
    base: Vec<u8>,
    batches: Vec<Vec<u8>>,
    previous: Option<Value>,
    exports: usize,
    changes: usize,
    most: usize,
    largest: usize,
}

impl Chain {
    /// Adds an export and checks the chain rebuilds it.
    fn add(&mut self, json: &str) {
        let Ok(export) = account::parse(json.as_bytes()) else {
            panic!("the importer does not read the export");
        };
        self.exports += 1;
        let Some(previous) = self.previous.replace(export.value) else {
            self.base = json.as_bytes().to_vec();
            return;
        };
        let changes = delta::diff(&previous, self.previous.as_ref().unwrap());
        let bytes = serde_json::to_vec(&changes).unwrap();
        self.changes += changes.len();
        self.most = self.most.max(changes.len());
        self.largest = self.largest.max(bytes.len());
        self.batches.push(bytes);
        let rebuilt = delta::rebuild(
            &self.base,
            self.batches.iter().map(Vec::as_slice),
            export.data.timestamp.expect("the export has its time"),
            &export.content_hash,
        );
        if let Err(err) = rebuilt {
            panic!("export {} does not rebuild: {err}", self.exports);
        }
    }
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
            && decoder.feed(data, at_ms).data
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
