// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Rules every committed file must follow: no secrets, account data, game
//! data, recordings or game art; UTF-8 text with license headers; English
//! text; consistent versions. Runs on the staged files (pre-commit), on all
//! files (CI), or on every commit (`--all-history`, before going public).
//!
//! Problems name the file and line only, never the matched text, so the
//! output itself cannot leak what it found.

use std::collections::BTreeMap;
use std::fs;
use std::io::{BufRead, BufReader, ErrorKind, Write};
use std::path::Path;
use std::process::{Command, Stdio};

use anyhow::{Context, Result, bail};
use serde_json::Value;

use crate::{changelog, util};

pub enum Mode {
    Staged,
    All,
    AllHistory,
}

impl Mode {
    pub fn parse(args: &[&str]) -> Result<Self> {
        match args {
            [] | ["--all"] => Ok(Self::All),
            ["--staged"] => Ok(Self::Staged),
            ["--all-history"] => Ok(Self::AllHistory),
            _ => bail!("usage: cargo xtask guard [--staged|--all|--all-history]"),
        }
    }
}

const MAX_BYTES: usize = 512 * 1024;
const LARGE_FILE_ALLOWLIST: &[&str] = &["Cargo.lock", "pnpm-lock.yaml"];
/// Our own logo sources, the app icons generated from them, the README
/// screenshots and the QQ group's QR code: the only places for images, and
/// for binary files at all.
const ASSET_DIRS: &[&str] = &[
    "assets/community/",
    "assets/logo/",
    "assets/screenshots/",
    "apps/desktop/src-tauri/icons/",
];
/// Where CJK text may appear: the Chinese README (and the English one, for the
/// link to it), the Chinese changelog, the Chinese UI strings, the installer
/// hooks' message and the game names the data generator adds by hand.
/// Entries ending in `/` cover a whole directory.
const CJK_ALLOWLIST: &[&str] = &[
    "README.md",
    "README.zh-CN.md",
    changelog::FILE_ZH,
    "apps/desktop/src/text/",
    "apps/desktop/src-tauri/src/text.rs",
    "apps/desktop/src-tauri/installer-hooks.nsh",
    "tools/datagen/src/manual.ts",
];
/// Public wording that must not claim safety or ban avoidance (warnings only).
const WORDING_FILES: &[&str] = CJK_ALLOWLIST;
/// Synthetic test data may use account-shaped JSON inside these directories.
const FIXTURE_DIR: &str = "fixtures";

const SPDX_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "mjs", "cjs", "css", "toml", "yml", "yaml",
];
const SPDX_EXEMPT: &[&str] = &["pnpm-lock.yaml", "pnpm-workspace.yaml"];
/// Our files are MIT; copied upstream files keep MIT or the usual Rust dual
/// license. Anything else (GPL in particular) must not come in unnoticed.
const SPDX_LICENSES: &[&str] = &["MIT", "MIT OR Apache-2.0", "Apache-2.0 OR MIT"];

// Name rules compare lowercase names; Windows file names ignore case.
const ASSET_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "icns", "avif", "tif", "tiff", "svg", "jxl",
    "heic", "heif", "apng", "dds", "tga", "psd", "ttf", "ttc", "otf", "woff", "woff2", "eot",
];
const SECRET_SUFFIXES: &[&str] = &["pem", "key", "pfx", "p12"];
const FORBIDDEN_NAMES: &[&str] = &["gi.json", "game_data.gz", "protos.proto"];
/// Long base64 runs: the dispatch keys in `gi.json` are about 5,500 characters
/// each, so a renamed copy still trips this.
const MIN_KEY_MATERIAL: usize = 2048;

struct Entry {
    path: String,
    bytes: Vec<u8>,
}

#[derive(Default)]
struct Report {
    problems: Vec<String>,
    warnings: Vec<String>,
}

impl Report {
    fn problem(&mut self, path: &str, msg: impl AsRef<str>) {
        self.problems.push(format!("{path}: {}", msg.as_ref()));
    }

    fn warning(&mut self, path: &str, msg: impl AsRef<str>) {
        self.warnings.push(format!("{path}: {}", msg.as_ref()));
    }
}

pub fn run(root: &Path, mode: Mode) -> Result<()> {
    let mut report = Report::default();
    let checked = match mode {
        Mode::AllHistory => check_history(root, &mut report)?,
        Mode::Staged | Mode::All => {
            let staged = matches!(mode, Mode::Staged);
            let entries = collect(root, staged, &mut report)?;
            for entry in &entries {
                check_entry(&entry.path, &entry.bytes, false, &mut report);
            }
            if !staged {
                for file in changelog::FILES {
                    if !entries.iter().any(|e| e.path == file) {
                        report.problem(file, "missing");
                    }
                }
                check_versions(root, &mut report)?;
            }
            format!("{} file(s)", entries.len())
        }
    };
    for warning in &report.warnings {
        println!("guard warning: {warning}");
    }
    for problem in &report.problems {
        eprintln!("guard: {problem}");
    }
    if !report.problems.is_empty() {
        bail!(
            "guard found {} problem(s) in {checked} checked",
            report.problems.len()
        );
    }
    println!("guard: {checked} checked, no problems");
    Ok(())
}

/// Every file version, commit message and tag message reachable from any
/// ref, local ones included. Only the leak checks and the license refusal
/// run: the whole-tree checks (versions, changelog presence, untracked
/// directories) and the style checks (SPDX header presence, CJK, wording,
/// manifests) follow today's rules, which older commits predate.
fn check_history(root: &Path, report: &mut Report) -> Result<String> {
    let commits = util::output(history_git(root).args([
        "rev-list",
        "--all",
        "--reverse",
        "--abbrev-commit",
    ]))?;
    // blob -> path -> the oldest commit with that file version.
    let mut files: BTreeMap<String, BTreeMap<String, &str>> = BTreeMap::new();
    for commit in commits.lines() {
        let tree = util::output_bytes(history_git(root).args(["ls-tree", "-r", "-z", commit]))?;
        for (blob, path) in tree_blobs(&tree) {
            files.entry(blob).or_default().entry(path).or_insert(commit);
        }
    }
    let mut cat = history_git(root)
        .args(["cat-file", "--batch"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .context("failed to start `git cat-file --batch`")?;
    let mut input = cat.stdin.take().context("no stdin for git cat-file")?;
    let mut output = BufReader::new(cat.stdout.take().context("no stdout for git cat-file")?);
    let mut versions = 0;
    for (blob, paths) in &files {
        let bytes = read_blob(&mut input, &mut output, blob)?;
        for (path, commit) in paths {
            let mut found = Report::default();
            check_entry(path, &bytes, true, &mut found);
            let found = found.problems.into_iter();
            report
                .problems
                .extend(found.map(|problem| format!("{commit} {problem}")));
            versions += 1;
        }
    }
    drop(input);
    let status = cat.wait().context("waiting for git cat-file")?;
    if !status.success() {
        bail!("`git cat-file --batch` failed ({status})");
    }
    let log =
        util::output_bytes(history_git(root).args(["log", "--all", "-z", "--format=%h%n%B"]))?;
    for record in split_nul(&log) {
        let (commit, message) = record.split_once('\n').unwrap_or((&record, ""));
        if has_secret_marker(message) || has_key_material(message) {
            report.problem(
                commit,
                "commit message looks like it contains a private key, key material or a wish history link",
            );
        }
    }
    // `rev-list --all` follows commits only, so a ref must end at a commit,
    // directly or through one annotated tag. Ref names have no spaces.
    let refs = util::output(history_git(root).args([
        "for-each-ref",
        "--format=%(objecttype) %(*objecttype) %(refname)",
    ]))?;
    for line in refs.lines() {
        let (kinds, name) = line.rsplit_once(' ').unwrap_or(("", line));
        match kinds {
            "commit " => {}
            "tag commit" => {
                let tag = util::output_bytes(history_git(root).args(["cat-file", "tag", name]))?;
                let tag = String::from_utf8_lossy(&tag);
                if has_secret_marker(&tag) || has_key_material(&tag) {
                    report.problem(
                        name,
                        "tag message looks like it contains a private key, key material or a wish history link",
                    );
                }
            }
            _ => report.problem(
                name,
                "points at a tree, a blob or another tag instead of a commit, so guard cannot check it",
            ),
        }
    }
    Ok(format!(
        "{} commit(s), {} blob(s) at {versions} path(s)",
        commits.lines().count(),
        files.len()
    ))
}

/// Git for `check_history`. Replacements (`git replace`) are ignored: a push
/// sends the original objects.
fn history_git(root: &Path) -> Command {
    let mut cmd = util::command("git", root);
    cmd.env("GIT_NO_REPLACE_OBJECTS", "1");
    cmd
}

/// `(blob, path)` pairs from `git ls-tree -r -z`. Submodules (type `commit`)
/// are skipped; symlinks are blobs and are checked like files.
fn tree_blobs(listing: &[u8]) -> Vec<(String, String)> {
    split_nul(listing)
        .into_iter()
        .filter_map(|record| {
            let (meta, path) = record.split_once('\t')?;
            match meta.split(' ').collect::<Vec<_>>()[..] {
                [_, "blob", blob] => Some((blob.to_owned(), path.to_owned())),
                _ => None,
            }
        })
        .collect()
}

/// Asks `git cat-file --batch` for one blob and reads back
/// `<id> blob <size>\n<content>\n`.
fn read_blob(input: &mut impl Write, output: &mut impl BufRead, blob: &str) -> Result<Vec<u8>> {
    writeln!(input, "{blob}")?;
    input.flush()?;
    let mut header = String::new();
    output.read_line(&mut header)?;
    let size = match header.split_whitespace().collect::<Vec<_>>()[..] {
        [_, "blob", size] => size.parse::<usize>().ok(),
        _ => None,
    }
    .with_context(|| format!("git cat-file could not read blob {blob}"))?;
    let mut bytes = vec![0; size + 1];
    output.read_exact(&mut bytes)?;
    bytes.pop();
    Ok(bytes)
}

fn collect(root: &Path, staged: bool, report: &mut Report) -> Result<Vec<Entry>> {
    let mut entries = Vec::new();
    if staged {
        // Everything except deletions, including type changes.
        let names = util::output_bytes(util::command("git", root).args([
            "diff",
            "--cached",
            "--name-only",
            "--diff-filter=d",
            "-z",
        ]))?;
        for path in split_nul(&names) {
            let bytes = util::output_bytes(
                util::command("git", root)
                    .arg("show")
                    .arg(format!(":{path}")),
            )
            .with_context(|| format!("reading staged {path}"))?;
            entries.push(Entry { path, bytes });
        }
    } else {
        // Untracked but not ignored files count too: they are what the
        // next commit would add.
        let names = util::output_bytes(util::command("git", root).args([
            "ls-files",
            "-z",
            "--cached",
            "--others",
            "--exclude-standard",
        ]))?;
        for path in split_nul(&names) {
            let full = root.join(&path);
            if path.ends_with('/') || full.is_dir() {
                report.problem(
                    &path,
                    "untracked directory, probably a nested repository; move it under .temp/",
                );
                continue;
            }
            match fs::read(&full) {
                Ok(bytes) => entries.push(Entry { path, bytes }),
                // Deleted in the working tree but still in the index.
                Err(err) if err.kind() == ErrorKind::NotFound => {}
                Err(err) => return Err(err).with_context(|| format!("reading {path}")),
            }
        }
    }
    Ok(entries)
}

fn split_nul(bytes: &[u8]) -> Vec<String> {
    bytes
        .split(|b| *b == 0)
        .filter(|part| !part.is_empty())
        .map(|part| String::from_utf8_lossy(part).into_owned())
        .collect()
}

enum Decoded {
    Utf8(String),
    Utf16(String),
    Binary,
}

fn decode(bytes: &[u8]) -> Decoded {
    if let Ok(text) = std::str::from_utf8(bytes) {
        return Decoded::Utf8(text.to_owned());
    }
    let units = |big_endian: bool| {
        bytes[2..]
            .as_chunks::<2>()
            .0
            .iter()
            .map(move |pair| {
                if big_endian {
                    u16::from_be_bytes(*pair)
                } else {
                    u16::from_le_bytes(*pair)
                }
            })
            .collect::<Vec<u16>>()
    };
    let utf16 = match bytes {
        [0xFF, 0xFE, ..] => Some(units(false)),
        [0xFE, 0xFF, ..] => Some(units(true)),
        _ => None,
    };
    match utf16 {
        Some(units) => Decoded::Utf16(String::from_utf16_lossy(&units)),
        None => Decoded::Binary,
    }
}

/// `leaks_only` skips the style and manifest checks (see `check_history`).
fn check_entry(path: &str, bytes: &[u8], leaks_only: bool, report: &mut Report) {
    let lower = path.to_ascii_lowercase();
    let in_asset_dir = ASSET_DIRS.iter().any(|dir| lower.starts_with(dir));
    if let Some(reason) = forbidden_path(path) {
        report.problem(path, reason);
    }
    if bytes.len() > MAX_BYTES && !LARGE_FILE_ALLOWLIST.contains(&path) {
        report.problem(
            path,
            format!(
                "larger than {} KiB and not on the allowlist",
                MAX_BYTES / 1024
            ),
        );
    }
    let text = match decode(bytes) {
        Decoded::Utf8(text) => text,
        Decoded::Utf16(text) => {
            report.problem(path, "UTF-16 text; every text file must be UTF-8");
            text
        }
        Decoded::Binary => {
            let is_icon = in_asset_dir && ASSET_EXTENSIONS.contains(&extension(&lower));
            if !is_icon {
                report.problem(
                    path,
                    "binary or non-UTF-8 file; only app icons may be binary",
                );
            }
            if secret_markers()
                .iter()
                .any(|marker| contains_bytes(bytes, marker.as_bytes()))
            {
                report.problem(
                    path,
                    "looks like it contains a private key or a wish history link",
                );
            }
            return;
        }
    };
    check_text(path, &lower, in_asset_dir, &text, leaks_only, report);
}

fn check_text(
    path: &str,
    lower: &str,
    in_asset_dir: bool,
    text: &str,
    leaks_only: bool,
    report: &mut Report,
) {
    let name = file_name(lower);
    let ext = extension(lower);
    if has_secret_marker(text) {
        report.problem(
            path,
            "looks like it contains a private key or a wish history link",
        );
    }
    if !in_asset_dir && has_key_material(text) {
        report.problem(
            path,
            "contains a very long base64 run; looks like key material",
        );
    }
    if text.contains(insecure_marker().as_str()) {
        report.problem(
            path,
            "the insecure updater transport option belongs only in .temp/ test configs",
        );
    }
    let json = text.trim_start_matches('\u{FEFF}');
    if ext == "json" && !in_fixture_dir(lower) && looks_like_account_data(json) {
        report.problem(
            path,
            "looks like account data; synthetic fixtures go under a fixtures/ directory",
        );
    }
    let spdx = SPDX_EXTENSIONS.contains(&ext) && !SPDX_EXEMPT.contains(&path);
    if leaks_only {
        // A disallowed license goes public with the history too.
        if spdx && let Some(reason) = disallowed_license(text) {
            report.problem(path, reason);
        }
        return;
    }
    if matches!(name, "package.json" | "tauri.conf.json") {
        match serde_json::from_str::<Value>(json) {
            Err(_) => report.problem(path, "not valid JSON"),
            Ok(value) => {
                if value.get("version").is_some() {
                    report.problem(
                        path,
                        "must not set `version`; the only version is in the root Cargo.toml",
                    );
                }
            }
        }
    }
    if spdx && let Some(reason) = spdx_problem(text) {
        report.problem(path, reason);
    }
    if changelog::FILES.contains(&path) {
        for problem in changelog::validate(path, text) {
            report.problem(path, problem);
        }
    }
    if !listed(CJK_ALLOWLIST, path) {
        let lines = cjk_lines(text);
        if let Some(first) = lines.first() {
            let more = match lines.len() {
                1 => String::new(),
                n => format!(" and {} more", n - 1),
            };
            report.problem(
                path,
                format!("CJK text on line {first}{more}; only the files in CJK_ALLOWLIST (xtask/src/guard.rs) may contain it"),
            );
        }
    }
    if listed(WORDING_FILES, path) {
        for (line, term) in wording_hits(text) {
            report.warning(
                path,
                format!("line {line} uses \"{term}\"; avoid claims about safety or ban risk"),
            );
        }
    }
}

/// Exact paths, or whole directories for entries ending in `/`.
fn listed(list: &[&str], path: &str) -> bool {
    list.iter().any(|entry| {
        if entry.ends_with('/') {
            path.starts_with(entry)
        } else {
            path == *entry
        }
    })
}

fn file_name(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

/// The last extension of a lowercase path, or "" for none.
fn extension(path: &str) -> &str {
    let name = file_name(path);
    match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => ext,
        _ => "",
    }
}

fn in_fixture_dir(lower: &str) -> bool {
    lower
        .split('/')
        .rev()
        .skip(1)
        .any(|part| part == FIXTURE_DIR)
}

fn contains_bytes(haystack: &[u8], needle: &[u8]) -> bool {
    !needle.is_empty()
        && haystack
            .windows(needle.len())
            .any(|window| window == needle)
}

/// Why a path may not be committed, judged by its name alone.
fn forbidden_path(path: &str) -> Option<&'static str> {
    let lower = path.to_ascii_lowercase();
    if lower.starts_with(".temp/") || lower.starts_with(".claude/") {
        return Some(".temp/ and .claude/ are never committed");
    }
    let name = file_name(&lower);
    // Every suffix counts, so `login.pcapng.gz` and `cache.sqlite.bak` match.
    let suffixes: Vec<&str> = name.split('.').skip(1).collect();
    let has = |test: &dyn Fn(&str) -> bool| suffixes.iter().any(|s| test(s));
    if has(&|s| SECRET_SUFFIXES.contains(&s)) || name.starts_with(".env") || name == "gi.json" {
        return Some("key or secret file");
    }
    if has(&|s| s == "db" || s.starts_with("db-") || s.starts_with("sqlite")) {
        return Some("database file (holds account data)");
    }
    if has(&|s| s.starts_with("pcap") || s == "etl") {
        return Some("packet capture or trace recording");
    }
    if name.starts_with("leyline-") && has(&|s| s == "json") {
        return Some("account export");
    }
    let game_data = lower
        .split('/')
        .any(|part| part == "game-data" || part.contains("binoutput") || part.contains("textmap"));
    if FORBIDDEN_NAMES.contains(&name) || game_data {
        return Some("game data table or protocol definition");
    }
    if ASSET_EXTENSIONS.contains(&extension(&lower))
        && !ASSET_DIRS.iter().any(|dir| lower.starts_with(dir))
    {
        return Some(
            "image or font outside the allowed logo, icon and screenshot directories (possible game art)",
        );
    }
    None
}

/// Built from pieces so this file does not match its own checks.
fn secret_markers() -> [String; 4] {
    [
        ["PRIVATE", " KEY-----"].concat(),
        ["rsign encrypted", " secret key"].concat(),
        // Base64 of the text above with its "untrusted comment: " prefix:
        // the start of a Tauri updater key file.
        [
            "dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWdu",
            "IGVuY3J5cHRlZCBzZWNyZXQga2V5",
        ]
        .concat(),
        ["auth", "key="].concat(),
    ]
}

fn has_secret_marker(text: &str) -> bool {
    secret_markers()
        .iter()
        .any(|marker| text.contains(marker.as_str()))
}

fn insecure_marker() -> String {
    ["dangerousInsecure", "TransportProtocol"].concat()
}

fn has_key_material(text: &str) -> bool {
    let mut run = 0;
    for b in text.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'=' | b'-' | b'_') {
            run += 1;
            if run >= MIN_KEY_MATERIAL {
                return true;
            }
        } else {
            run = 0;
        }
    }
    false
}

fn looks_like_account_data(text: &str) -> bool {
    match serde_json::from_str::<Value>(text) {
        Ok(value) => {
            value.get("format").and_then(Value::as_str) == Some("GOOD") || has_account_shape(&value)
        }
        Err(_) => {
            (text.contains("\"format\"") && text.contains("\"GOOD\""))
                || text.contains("\"gi_player\"")
        }
    }
}

/// A numeric UID, a `gi_player` record, or a nickname next to a birthday.
/// UI strings that merely name these fields do not match.
fn has_account_shape(value: &Value) -> bool {
    match value {
        Value::Object(map) => {
            let numeric_uid = map.get("uid").is_some_and(|uid| match uid {
                Value::Number(_) => true,
                Value::String(s) => !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()),
                _ => false,
            });
            let profile = map.contains_key("nickname") && map.contains_key("birthday");
            numeric_uid
                || profile
                || map.contains_key("gi_player")
                || map.values().any(has_account_shape)
        }
        Value::Array(items) => items.iter().any(has_account_shape),
        _ => false,
    }
}

fn spdx_problem(text: &str) -> Option<String> {
    let first = text.lines().next().unwrap_or_default();
    if !first.contains("SPDX-License-Identifier:") {
        return Some("the first line must be an SPDX-License-Identifier comment".to_owned());
    }
    if let Some(problem) = disallowed_license(text) {
        return Some(problem);
    }
    if !text.lines().take(5).any(|line| line.contains("Copyright")) {
        return Some("needs a Copyright line within the first 5 lines".to_owned());
    }
    None
}

/// A first-line SPDX id that is not on `SPDX_LICENSES`.
fn disallowed_license(text: &str) -> Option<String> {
    let first = text.lines().next().unwrap_or_default();
    let (_, id) = first.split_once("SPDX-License-Identifier:")?;
    let id = id.trim().trim_end_matches("*/").trim();
    (!SPDX_LICENSES.contains(&id)).then(|| {
        format!(
            "license `{id}` is not allowed; use one of: {}",
            SPDX_LICENSES.join(", ")
        )
    })
}

fn cjk_lines(text: &str) -> Vec<usize> {
    text.lines()
        .enumerate()
        .filter(|(_, line)| line.chars().any(util::is_cjk))
        .map(|(idx, _)| idx + 1)
        .collect()
}

fn wording_hits(text: &str) -> Vec<(usize, &'static str)> {
    // "safe" (an quan) and "account ban" (feng hao), spelled as escapes so this
    // file stays free of CJK text.
    const TERMS: &[&str] = &[
        "\u{5B89}\u{5168}",
        "\u{5C01}\u{53F7}",
        "safe",
        "secure",
        "banned",
        "undetect",
    ];
    let mut hits = Vec::new();
    for (idx, line) in text.lines().enumerate() {
        let lower = line.to_lowercase();
        for term in TERMS {
            if lower.contains(term) {
                hits.push((idx + 1, *term));
            }
        }
    }
    hits
}

/// `[workspace.package] version`, if present.
pub fn workspace_version(manifest: &toml_edit::DocumentMut) -> Option<&str> {
    manifest
        .get("workspace")
        .and_then(|w| w.get("package"))
        .and_then(|p| p.get("version"))
        .and_then(toml_edit::Item::as_str)
}

/// Workspace members inherit one version; Cargo.lock must agree with it.
fn check_versions(root: &Path, report: &mut Report) -> Result<()> {
    let manifest = fs::read_to_string(root.join("Cargo.toml")).context("reading Cargo.toml")?;
    let manifest: toml_edit::DocumentMut = manifest.parse().context("parsing Cargo.toml")?;
    let Some(version) = workspace_version(&manifest) else {
        report.problem("Cargo.toml", "missing [workspace.package] version");
        return Ok(());
    };
    if util::parse_version(version).is_none() {
        report.problem("Cargo.toml", "the workspace version must be X.Y.Z");
    }
    let metadata = util::output(util::cargo(root).args([
        "metadata",
        "--locked",
        "--no-deps",
        "--format-version",
        "1",
    ]))?;
    let metadata: Value = serde_json::from_str(&metadata).context("parsing cargo metadata")?;
    let mut members = Vec::new();
    for package in metadata["packages"].as_array().into_iter().flatten() {
        let name = package["name"].as_str().unwrap_or_default().to_owned();
        let member_version = package["version"].as_str().unwrap_or_default();
        if member_version != version {
            report.problem(
                "Cargo.toml",
                format!("{name} is {member_version}; members use `version.workspace = true`"),
            );
        }
        members.push(name);
    }
    let lock = fs::read_to_string(root.join("Cargo.lock")).context("reading Cargo.lock")?;
    let lock: toml_edit::DocumentMut = lock.parse().context("parsing Cargo.lock")?;
    let packages = lock
        .get("package")
        .and_then(toml_edit::Item::as_array_of_tables);
    for package in packages.into_iter().flatten() {
        let name = package
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let is_member = package.get("source").is_none() && members.iter().any(|m| m == name);
        let lock_version = package
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        if is_member && lock_version != version {
            report.problem(
                "Cargo.lock",
                format!("{name} is {lock_version}, not {version}; run `cargo update --workspace`"),
            );
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn problems_for(path: &str, bytes: &[u8]) -> Vec<String> {
        let mut report = Report::default();
        check_entry(path, bytes, false, &mut report);
        report.problems
    }

    #[test]
    fn history_mode_keeps_leak_checks_and_skips_style_checks() {
        let mut report = Report::default();
        check_entry("src/a.rs", "\u{4E2D}\n".as_bytes(), true, &mut report);
        assert!(report.problems.is_empty());
        let marker = ["auth", "key=x"].concat();
        check_entry("src/a.rs", marker.as_bytes(), true, &mut report);
        check_entry(".temp/a.txt", b"", true, &mut report);
        assert_eq!(report.problems.len(), 2);
        let gpl = "// SPDX-License-Identifier: GPL-3.0-only\n";
        check_entry("src/b.rs", gpl.as_bytes(), true, &mut report);
        assert!(report.problems[2].contains("not allowed"));
    }

    #[test]
    fn tree_listings_yield_blobs_only() {
        let listing = b"100644 blob aaa\tsrc/a b.rs\0\
            120000 blob bbb\tlink\0\
            160000 commit ccc\tvendor/sub\0";
        assert_eq!(
            tree_blobs(listing),
            vec![
                ("aaa".to_owned(), "src/a b.rs".to_owned()),
                ("bbb".to_owned(), "link".to_owned()),
            ]
        );
    }

    #[test]
    fn blobs_are_read_one_at_a_time() -> Result<()> {
        let mut input = Vec::new();
        let mut output = std::io::Cursor::new(b"aaa blob 3\nx\ny\nbbb missing\n".to_vec());
        assert_eq!(read_blob(&mut input, &mut output, "aaa")?, b"x\ny");
        assert!(read_blob(&mut input, &mut output, "bbb").is_err());
        assert_eq!(input, b"aaa\nbbb\n");
        Ok(())
    }

    #[test]
    fn secrets_recordings_databases_and_game_data_are_refused() {
        for path in [
            "gi.json",
            "GI.json",
            "keys/updater.key",
            "a/b/server.PEM",
            "KEY.P12",
            ".env.local",
            ".ENV",
            "moongazer.db",
            "moongazer.db-wal",
            "moongazer.db-journal",
            "data/cache.sqlite3",
            "data/cache.sqlite.bak",
            "login.pcapng",
            "login.pcapng.gz",
            "TRACE.ETL",
            "leyline-2026-11-15.json",
            "Leyline-2026-11-15.JSON",
            "game-data/x.json.gz",
            "dump/ExcelBinOutput/AvatarExcelConfigData.json",
            "TextMapCHS.json",
            "game_data.gz",
            "proto/protos.proto",
            ".temp/notes.txt",
            ".claude/PLAN.md",
        ] {
            assert!(forbidden_path(path).is_some(), "{path} should be refused");
        }
    }

    #[test]
    fn ordinary_files_and_our_icons_are_allowed() {
        for path in [
            "Cargo.toml",
            "xtask/src/guard.rs",
            "README.md",
            ".editorconfig",
            ".gitignore",
            "apps/desktop/src-tauri/icons/icon.ico",
            "assets/logo/logo.svg",
            "assets/screenshots/overview.webp",
            "apps/desktop/src/game-database.ts",
            "keyboard.rs",
            "monkey.rs",
        ] {
            assert_eq!(forbidden_path(path), None, "{path} should be allowed");
        }
        assert!(forbidden_path("apps/desktop/public/splash.webp").is_some());
        assert!(forbidden_path("fonts/HYWenHei.TTF").is_some());
        assert!(forbidden_path("fonts/x.ttc").is_some());
    }

    #[test]
    fn non_utf8_files_are_refused_unless_they_are_icons() {
        assert!(problems_for("notes.md", b"gbk \xd6\xd0\xce\xc4")[0].contains("non-UTF-8"));
        assert!(
            problems_for(
                "apps/desktop/src-tauri/icons/icon.ico",
                b"\x00\x00\x01\x00\xff"
            )
            .is_empty()
        );
        // UTF-16LE with a BOM: reported, and still checked for account data.
        let mut utf16 = vec![0xFF, 0xFE];
        for unit in r#"{"uid":1}"#.encode_utf16() {
            utf16.extend_from_slice(&unit.to_le_bytes());
        }
        let problems = problems_for("export.json", &utf16);
        assert!(problems.iter().any(|p| p.contains("UTF-16")));
        assert!(problems.iter().any(|p| p.contains("account data")));
    }

    #[test]
    fn json_with_account_shapes_is_caught_outside_fixtures() {
        assert!(looks_like_account_data(r#"{"format":"GOOD","version":3}"#));
        assert!(looks_like_account_data(r#"{"data":[{"uid":100000001}]}"#));
        assert!(looks_like_account_data(
            r#"{"p":{"nickname":"x","birthday":"0101"}}"#
        ));
        assert!(looks_like_account_data("{\"format\": \"GOOD\", broken"));
        assert!(!looks_like_account_data(
            r#"{"labels":{"uid":"UID","nickname":"Name"}}"#
        ));
        assert!(!looks_like_account_data(
            r#"{"name":"moongazer","private":true}"#
        ));
        assert!(in_fixture_dir("crates/account/fixtures/good-small.json"));
        assert!(!in_fixture_dir("fixtures.json"));
        let bom = "\u{FEFF}{\"format\":\"GOOD\"}".as_bytes().to_vec();
        assert!(
            problems_for("Export.JSON", &bom)
                .iter()
                .any(|p| p.contains("account data"))
        );
    }

    #[test]
    fn renamed_key_files_are_caught_by_their_content() {
        let long = "A".repeat(MIN_KEY_MATERIAL);
        assert!(has_key_material(&format!("{{\"1\":\"{long}\"}}")));
        assert!(!has_key_material(&"A".repeat(MIN_KEY_MATERIAL - 1)));
        assert!(!has_key_material("sha512-abcdefghij== and more text"));
    }

    #[test]
    fn spdx_header_must_be_first_allowed_and_followed_by_copyright() {
        let ok = "// SPDX-License-Identifier: MIT\n// Copyright (c) 2026 X\n";
        assert_eq!(spdx_problem(ok), None);
        assert!(
            spdx_problem("// Copyright (c) 2026 X\n// SPDX-License-Identifier: MIT\n").is_some()
        );
        assert!(spdx_problem("# SPDX-License-Identifier: MIT\n\n\n\n\n# Copyright\n").is_some());
        let gpl = "// SPDX-License-Identifier: GPL-3.0-only\n// Copyright (c) 2024 X\n";
        assert!(spdx_problem(gpl).is_some_and(|p| p.contains("not allowed")));
    }

    #[test]
    fn package_manifests_may_not_carry_a_version_or_be_invalid() {
        let versioned = br#"{"name":"x","version":"1.0.0"}"#;
        assert!(problems_for("apps/x/package.json", versioned)[0].contains("version"));
        let bom = "\u{FEFF}{\"name\":\"x\",\"version\":\"1.0.0\"}";
        assert!(problems_for("apps/x/package.json", bom.as_bytes())[0].contains("version"));
        assert!(problems_for("package.json", b"{broken")[0].contains("not valid JSON"));
        assert!(problems_for("package.json", br#"{"engines":{"version":"1"}}"#).is_empty());
    }

    #[test]
    fn ui_strings_may_be_chinese_but_code_may_not() {
        assert!(listed(CJK_ALLOWLIST, "apps/desktop/src/text/zh.ts"));
        assert!(listed(CJK_ALLOWLIST, "CHANGELOG.zh-CN.md"));
        assert!(!listed(CJK_ALLOWLIST, "CHANGELOG.md"));
        assert!(!listed(CJK_ALLOWLIST, "apps/desktop/src/app/App.tsx"));
        assert!(listed(CJK_ALLOWLIST, "tools/datagen/src/manual.ts"));
        assert!(!listed(CJK_ALLOWLIST, "tools/datagen/src/main.ts"));
        let code = "// SPDX-License-Identifier: MIT\n// Copyright (c) 2026 X\n\"\u{4E2D}\"\n";
        let problems = problems_for("apps/desktop/src/app/App.tsx", code.as_bytes());
        assert!(problems.iter().any(|p| p.contains("CJK")));
    }

    #[test]
    fn markers_and_wording_are_reported_by_line() {
        assert_eq!(cjk_lines("ok\n\u{4E2D}\nok\n"), vec![2]);
        assert_eq!(wording_hits("fine\nThis is Safe.\n"), vec![(2, "safe")]);
        let key_file = [
            "dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWdu",
            "IGVuY3J5cHRlZCBzZWNyZXQga2V5Cg==",
        ]
        .concat();
        assert!(
            secret_markers()
                .iter()
                .any(|m| key_file.contains(m.as_str()))
        );
    }
}
