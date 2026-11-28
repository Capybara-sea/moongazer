// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The wish history page's commands: the stored records, UIGF files in and
//! out (<https://uigf.org>, version 4), and auto sync's reading of the game's
//! history (`capture::wishes`).

use std::collections::HashMap;

use serde::Serialize;
use serde_json::{Value, json};
use storage::Wish;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::capture::ItemIds;
use crate::snapshots::{SnapshotError, Storage};

/// The banners whose wishes are kept: novice, standard, the character
/// events (301 and 400), the weapon event and the chronicled wish.
pub const GACHA_TYPES: [u32; 6] = [100, 200, 301, 302, 400, 500];

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum WishFileError {
    NotJson,
    /// JSON, but not a UIGF file.
    NotUigf,
    /// A UIGF file older than version 4, which this does not read.
    OldVersion(String),
    Storage(String),
    Save(String),
}

impl From<SnapshotError> for WishFileError {
    fn from(err: SnapshotError) -> Self {
        Self::Storage(format!("{err:?}"))
    }
}

/// An account in a UIGF file.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileAccount {
    pub uid: u64,
    /// Records of the banners kept.
    pub records: usize,
}

/// What importing one account of a file came to.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Imported {
    pub uid: u64,
    pub added: usize,
    /// Records the account had already.
    pub known: usize,
    /// Records the file names no item id for.
    pub unknown_items: usize,
    /// Records of other banners (such as Miliastra Wonderland's) or that
    /// could not be read, left out.
    pub skipped: usize,
    /// Both the file and the account had records but none in common: the
    /// history may miss the wishes between them.
    pub gap: bool,
}

/// UIGF's page, fixed here like the homepage.
const UIGF_PAGE: &str = "https://uigf.org";

/// When the wish history was last read from the game, by UID.
pub fn read_at_key(uid: u64) -> String {
    format!("wishes.readAt:{uid}")
}

/// The account's wishes, oldest first. Those stored without an item id get
/// one first where the game data knows the name: records read before the
/// reader filled them in, or from a file without them.
fn stored_wishes(storage: &Storage, uid: u64) -> Result<Vec<Wish>, SnapshotError> {
    storage.with_db(|db| {
        if let Some(ids) = ItemIds::built_in() {
            let filled = db.fill_item_ids(uid, |item_type, name| ids.id(item_type, name))?;
            if filled > 0 {
                tracing::info!(filled, "wish item ids filled in");
            }
        }
        db.wishes(uid)
    })
}

/// The account's wishes, oldest first, each `[id, gacha_type, item_id,
/// rank, time, name]` with the id as text (it does not fit a JS number),
/// and when the history was last read from the game (Unix ms).
#[tauri::command]
pub async fn wish_records(storage: State<'_, Storage>, uid: u64) -> Result<String, SnapshotError> {
    let wishes = stored_wishes(&storage, uid)?;
    let read_at = storage
        .read_setting(&read_at_key(uid))?
        .and_then(|at| at.parse::<i64>().ok());
    let rows: Vec<Value> = wishes
        .iter()
        .map(|w| {
            json!([
                w.id.to_string(),
                w.gacha_type,
                w.item_id,
                w.rank,
                w.time,
                w.name
            ])
        })
        .collect();
    Ok(json!({ "records": rows, "readAt": read_at }).to_string())
}

#[tauri::command]
pub fn open_uigf() -> Result<(), SnapshotError> {
    tauri_plugin_opener::open_url(UIGF_PAGE, None::<&str>)
        .map_err(|err| SnapshotError::OpenLink(err.to_string()))
}

/// The accounts a UIGF file has, to ask which to import.
#[tauri::command]
pub async fn read_wish_file(text: String) -> Result<Vec<FileAccount>, WishFileError> {
    Ok(parse(&text)?
        .into_iter()
        .map(|account| FileAccount {
            uid: account.uid,
            records: account.wishes.len(),
        })
        .collect())
}

/// Imports the accounts `uids` of a UIGF file.
#[tauri::command]
pub async fn import_wish_file(
    storage: State<'_, Storage>,
    text: String,
    uids: Vec<u64>,
) -> Result<Vec<Imported>, WishFileError> {
    let mut results = Vec::new();
    for mut account in parse(&text)? {
        if !uids.contains(&account.uid) {
            continue;
        }
        if let Some(ids) = ItemIds::built_in() {
            ids.fill(&mut account.wishes);
        }
        let uid = account.uid;
        let (before, added) = storage.with_db(|db| {
            let before = db.wish_count(uid)?;
            Ok((before, db.add_wishes(uid, &account.wishes)?))
        })?;
        let known = account.wishes.len() - added;
        results.push(Imported {
            uid,
            added,
            known,
            unknown_items: account.wishes.iter().filter(|w| w.item_id == 0).count(),
            skipped: account.skipped,
            gap: before > 0 && added > 0 && known == 0,
        });
    }
    let added: usize = results.iter().map(|r| r.added).sum();
    tracing::info!(accounts = results.len(), added, "wish file imported");
    Ok(results)
}

/// A UIGF file written.
#[derive(Debug, Serialize)]
pub struct Exported {
    pub path: String,
    pub count: usize,
}

/// Writes the account's wishes as a UIGF v4.0 file where the user picks;
/// `None` when they cancel. `items` are the items' name and item type in
/// `lang` by item id, which the file is written in; an item without one
/// keeps what it came with.
#[tauri::command]
pub async fn export_wish_file(
    app: AppHandle,
    storage: State<'_, Storage>,
    uid: u64,
    items: HashMap<u32, (String, String)>,
    lang: String,
    file_name: String,
) -> Result<Option<Exported>, WishFileError> {
    let wishes = stored_wishes(&storage, uid)?;
    let version = app.package_info().version.to_string();
    let json = to_uigf(uid, &wishes, &items, &lang, now_ms() / 1000, &version);
    let mut dialog = app
        .dialog()
        .file()
        .set_file_name(&file_name)
        .add_filter("UIGF", &["json"]);
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    let Some(picked) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|err| WishFileError::Save(err.to_string()))?;
    std::fs::write(&path, json).map_err(|err| WishFileError::Save(err.to_string()))?;
    tracing::info!(records = wishes.len(), "wish file exported");
    Ok(Some(Exported {
        path: path.display().to_string(),
        count: wishes.len(),
    }))
}

/// Shows a file in its folder.
#[tauri::command]
pub fn reveal_file(path: String) -> Result<(), SnapshotError> {
    tauri_plugin_opener::reveal_item_in_dir(path)
        .map_err(|err| SnapshotError::OpenFolder(err.to_string()))
}

/// One account of a file, its wishes as stored.
struct FileWishes {
    uid: u64,
    wishes: Vec<Wish>,
    skipped: usize,
}

fn parse(text: &str) -> Result<Vec<FileWishes>, WishFileError> {
    let root: Value = serde_json::from_str(text).map_err(|_| WishFileError::NotJson)?;
    let info = root.get("info").ok_or(WishFileError::NotUigf)?;
    // Version 3 and before named it `uigf_version` and had one account.
    if let Some(old) = info.get("uigf_version") {
        return Err(WishFileError::OldVersion(text_of(old).unwrap_or_default()));
    }
    let version = info.get("version").and_then(text_of).unwrap_or_default();
    if !version.starts_with("v4") {
        return Err(if version.is_empty() {
            WishFileError::NotUigf
        } else {
            WishFileError::OldVersion(version)
        });
    }
    let Some(accounts) = root.get("hk4e") else {
        // A v4 file of other games only.
        return Ok(Vec::new());
    };
    let accounts = accounts.as_array().ok_or(WishFileError::NotUigf)?;
    accounts
        .iter()
        .map(|account| {
            let uid = account
                .get("uid")
                .and_then(number_of)
                .ok_or(WishFileError::NotUigf)?;
            let timezone = account.get("timezone").and_then(Value::as_i64).unwrap_or(8);
            let list = account
                .get("list")
                .and_then(Value::as_array)
                .ok_or(WishFileError::NotUigf)?;
            let wishes: Vec<Wish> = list.iter().filter_map(|r| record(r, timezone)).collect();
            Ok(FileWishes {
                uid,
                skipped: list.len() - wishes.len(),
                wishes,
            })
        })
        .collect()
}

/// A record as stored; `None` for another banner's or one that cannot be read.
fn record(value: &Value, timezone: i64) -> Option<Wish> {
    let field = |name: &str| value.get(name).and_then(text_of);
    let gacha_type: u32 = field("gacha_type")?.parse().ok()?;
    if !GACHA_TYPES.contains(&gacha_type) {
        return None;
    }
    Some(Wish {
        id: field("id")?.parse().ok()?,
        gacha_type,
        item_id: field("item_id").and_then(|id| id.parse().ok()).unwrap_or(0),
        name: field("name").unwrap_or_default(),
        item_type: field("item_type").unwrap_or_default(),
        rank: field("rank_type")?.parse().ok()?,
        time: parse_time(&field("time")?, timezone)?,
    })
}

/// A field as text: files write numbers as strings, some as numbers.
fn text_of(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

fn number_of(value: &Value) -> Option<u64> {
    text_of(value)?.parse().ok()
}

/// `yyyy-MM-dd HH:mm:ss` at UTC+`timezone` hours, as Unix milliseconds.
pub fn parse_time(text: &str, timezone: i64) -> Option<i64> {
    let (date, time) = text.trim().split_once(' ')?;
    let mut date = date.split('-').map(str::parse::<i64>);
    let mut time = time.split(':').map(str::parse::<i64>);
    let (y, m, d) = (date.next()?.ok()?, date.next()?.ok()?, date.next()?.ok()?);
    let (h, min, s) = (time.next()?.ok()?, time.next()?.ok()?, time.next()?.ok()?);
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) || h > 23 || min > 59 || s > 60 {
        return None;
    }
    let seconds = days_from_civil(y, m, d) * 86_400 + h * 3_600 + min * 60 + s - timezone * 3_600;
    Some(seconds * 1000)
}

/// Unix milliseconds as `yyyy-MM-dd HH:mm:ss` at UTC+`timezone` hours.
pub fn format_time(ms: i64, timezone: i64) -> String {
    let seconds = ms.div_euclid(1000) + timezone * 3_600;
    let (days, of_day) = (seconds.div_euclid(86_400), seconds.rem_euclid(86_400));
    let (y, m, d) = civil_from_days(days);
    format!(
        "{y:04}-{m:02}-{d:02} {:02}:{:02}:{:02}",
        of_day / 3_600,
        of_day % 3_600 / 60,
        of_day % 60
    )
}

// Howard Hinnant's days_from_civil and civil_from_days.
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * (m + if m > 2 { -3 } else { 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (yoe + era * 400 + i64::from(m <= 2), m, d)
}

/// The UTC offset of an account's server, by its UID: America UTC-5, Europe
/// UTC+1, the rest UTC+8 (UIGF's table).
pub fn timezone(uid: u64) -> i64 {
    // The leading digit of a nine-digit UID, or the two of a ten-digit one.
    match uid / 100_000_000 {
        6 => -5,
        7 => 1,
        _ => 8,
    }
}

/// The account's wishes as UIGF v4.0 JSON, named as `items` has them, in `lang`.
fn to_uigf(
    uid: u64,
    wishes: &[Wish],
    items: &HashMap<u32, (String, String)>,
    lang: &str,
    exported_at: i64,
    version: &str,
) -> String {
    let timezone = timezone(uid);
    let list: Vec<Value> = wishes
        .iter()
        .map(|w| {
            let gacha_type = w.gacha_type.to_string();
            let (name, item_type) = items
                .get(&w.item_id)
                .map_or((&w.name, &w.item_type), |(name, kind)| (name, kind));
            json!({
                "uigf_gacha_type": if w.gacha_type == 400 { "301" } else { &gacha_type },
                "gacha_type": gacha_type,
                "item_id": if w.item_id == 0 { String::new() } else { w.item_id.to_string() },
                "count": "1",
                "time": format_time(w.time, timezone),
                "name": name,
                "item_type": item_type,
                "rank_type": w.rank.to_string(),
                "id": w.id.to_string(),
            })
        })
        .collect();
    json!({
        "info": {
            "export_timestamp": exported_at,
            "export_app": "Moongazer",
            "export_app_version": version,
            "version": "v4.0",
        },
        "hk4e": [{
            "uid": uid.to_string(),
            "timezone": timezone,
            "lang": lang,
            "list": list,
        }],
    })
    .to_string()
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FILE: &str = r#"{
        "info": { "export_timestamp": 1, "export_app": "Test", "export_app_version": "1", "version": "v4.1" },
        "hk4e": [
            { "uid": "100000001", "timezone": 8, "lang": "zh-cn", "list": [
                { "uigf_gacha_type": "301", "gacha_type": "400", "item_id": "10000002", "count": "1",
                  "time": "2026-01-02 03:04:05", "name": "Test Character", "item_type": "Character",
                  "rank_type": "5", "id": "1700000000000000001" },
                { "uigf_gacha_type": "200", "gacha_type": "200", "item_id": "", "count": "1",
                  "time": "2026-01-02 03:04:06", "name": "Test Weapon", "item_type": "Weapon",
                  "rank_type": 3, "id": 1700000000000000002 },
                { "uigf_gacha_type": "1000", "gacha_type": "1000", "item_id": "1", "count": "1",
                  "time": "2026-01-02 03:04:07", "name": "x", "item_type": "x",
                  "rank_type": "3", "id": "1700000000000000003" }
            ] },
            { "uid": 200000002, "list": [] }
        ]
    }"#;

    #[test]
    fn a_v4_file_reads_every_account_and_skips_other_banners() {
        let accounts = parse(FILE).unwrap();
        assert_eq!(accounts.len(), 2);
        let first = &accounts[0];
        assert_eq!(first.uid, 100_000_001);
        assert_eq!(first.wishes.len(), 2);
        assert_eq!(first.skipped, 1);
        assert_eq!(first.wishes[0].id, 1_700_000_000_000_000_001);
        assert_eq!(first.wishes[0].gacha_type, 400);
        assert_eq!(first.wishes[1].item_id, 0);
        assert_eq!(first.wishes[1].rank, 3);
        assert_eq!(accounts[1].uid, 200_000_002);
    }

    #[test]
    fn older_and_other_files_are_told_apart() {
        assert!(matches!(parse("not json"), Err(WishFileError::NotJson)));
        assert!(matches!(parse("{}"), Err(WishFileError::NotUigf)));
        let v3 = r#"{ "info": { "uid": "1", "uigf_version": "v3.0" }, "list": [] }"#;
        assert!(matches!(parse(v3), Err(WishFileError::OldVersion(v)) if v == "v3.0"));
    }

    #[test]
    fn times_convert_both_ways_in_the_servers_zone() {
        let ms = parse_time("2026-01-02 03:04:05", 8).unwrap();
        assert_eq!(ms, 1_767_294_245_000);
        assert_eq!(format_time(ms, 8), "2026-01-02 03:04:05");
        assert_eq!(format_time(ms, -5), "2026-01-01 14:04:05");
        assert_eq!(parse_time("2026-13-02 03:04:05", 8), None);
        assert_eq!(parse_time("2026-01-02", 8), None);
    }

    #[test]
    fn a_uid_names_its_servers_zone() {
        assert_eq!(timezone(123_456_789), 8);
        assert_eq!(timezone(612_345_678), -5);
        assert_eq!(timezone(712_345_678), 1);
        assert_eq!(timezone(1_812_345_678), 8);
    }

    #[test]
    fn an_export_reads_back_as_the_same_wishes_with_the_names_given() {
        let wishes = &parse(FILE).unwrap()[0].wishes;
        let items = HashMap::from([(10_000_002, ("Renamed".to_owned(), "Kind".to_owned()))]);
        let json = to_uigf(100_000_001, wishes, &items, "zh-cn", 1, "0.0.0");
        let back = parse(&json).unwrap();
        assert_eq!(back.len(), 1);
        let mut expected = wishes.clone();
        expected[0].name = "Renamed".to_owned();
        expected[0].item_type = "Kind".to_owned();
        assert_eq!(back[0].wishes, expected);
        let value: Value = serde_json::from_str(&json).unwrap();
        let first = &value["hk4e"][0]["list"][0];
        assert_eq!(first["uigf_gacha_type"], "301");
        assert_eq!(value["hk4e"][0]["list"][1]["item_id"], "");
        assert_eq!(value["hk4e"][0]["list"][1]["name"], "Test Weapon");
    }
}
