// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! `cargo xtask dist`: the signed NSIS installer, the signed portable zip,
//! `latest.json` and `SHA256SUMS.txt`, all in `<target>/dist/v<version>/`.
//!
//! Signing reads `TAURI_SIGNING_PRIVATE_KEY` (the key, or a path to it) or
//! `TAURI_SIGNING_PRIVATE_KEY_PATH`, and for a key with a password,
//! `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The private key never lives in the
//! repository. The build runs scripts from hundreds of npm and Rust packages,
//! so it inherits none of these variables; only `tauri signer sign` gets the
//! key.
//!
//! `--config <file>` is merged into tauri.conf.json like the Tauri CLI's own
//! flag (test builds use it for a local endpoint and version). `--base-url`
//! points the download links in latest.json somewhere other than the GitHub
//! release.
//!
//! The build has auto sync: it runs `pack` first and ships the capture pack
//! next to the exe, in the installer and the zip. `--no-capture` builds
//! without it (hard rule: a build without capture must always be possible).

use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use zip::CompressionMethod;
use zip::write::{SimpleFileOptions, ZipWriter};

use crate::changelog::{self, Heading};
use crate::{gen_data, guard, util};

const PACKAGE: &str = "@moongazer/desktop";
const TAURI_CONF: &str = "apps/desktop/src-tauri/tauri.conf.json";
const BINARY: &str = "moongazer.exe";
/// Must match `MARKER` in apps/desktop/src-tauri/src/portable.rs.
const PORTABLE_MARKER: &str = "portable";
const MARKER_TEXT: &str = "This file makes Moongazer portable: its settings, data, logs and \
                           webview data stay in the app-data folder next to it.\r\n";
const SUMS: &str = "SHA256SUMS.txt";
/// The capture pack, written by `pack`; the app looks for it next to its exe.
const PACK_DIR: &str = "apps/desktop/src-tauri/capture-pack";
const PACK_FILES: [&str; 3] = ["gi.json", "game_data.gz", "pack.json"];

struct Options {
    config: Option<PathBuf>,
    base_url: Option<String>,
    capture: bool,
}

fn parse(args: &[&str]) -> Result<Options> {
    let mut options = Options {
        config: None,
        base_url: None,
        capture: true,
    };
    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        match *arg {
            "--config" => {
                let path = rest.next().context("--config needs a file")?;
                options.config =
                    Some(fs::canonicalize(path).with_context(|| format!("finding {path}"))?);
            }
            "--base-url" => {
                let url = rest.next().context("--base-url needs a URL")?;
                options.base_url = Some(format!("{}/", url.trim_end_matches('/')));
            }
            "--no-capture" => options.capture = false,
            other => {
                bail!(
                    "usage: cargo xtask dist [--config <file>] [--base-url <url>] [--no-capture]; got `{other}`"
                )
            }
        }
    }
    Ok(options)
}

pub fn run(root: &Path, args: &[&str]) -> Result<()> {
    let options = parse(args)?;
    let mut conf = read_json(&root.join(TAURI_CONF))?;
    if let Some(path) = &options.config {
        merge(&mut conf, read_json(path)?);
    }
    let product = conf["productName"]
        .as_str()
        .context("tauri.conf.json has no productName")?
        .to_owned();
    let manifest: toml_edit::DocumentMut = fs::read_to_string(root.join("Cargo.toml"))?.parse()?;
    let version = match conf.get("version").and_then(Value::as_str) {
        Some(v) => v.to_owned(),
        None => guard::workspace_version(&manifest)
            .context("missing [workspace.package] version")?
            .to_owned(),
    };
    let repo = manifest
        .get("workspace")
        .and_then(|w| w.get("package"))
        .and_then(|p| p.get("repository"))
        .and_then(toml_edit::Item::as_str)
        .context("missing [workspace.package] repository")?
        .trim_end_matches('/')
        .to_owned();

    if conf
        .pointer("/plugins/updater/pubkey")
        .and_then(Value::as_str)
        .is_none_or(str::is_empty)
    {
        bail!(
            "plugins.updater.pubkey is empty; generate the signing key and add its public key first"
        );
    }
    let key = signing_key()?;
    // Everything that can fail cheaply goes before the long build.
    let notes = release_notes(root, &version)?;
    let pub_date = util::now_rfc3339()?;
    let zip_time = commit_time(root)?;

    let target = target_dir(root)?;
    if options.capture {
        build_pack(root)?;
    }
    let out = target.join("dist").join(format!("v{version}"));
    if out.exists() {
        fs::remove_dir_all(&out).with_context(|| format!("clearing {}", out.display()))?;
    }
    fs::create_dir_all(&out)?;

    // The data generator downloads files and the Tauri bundler builds the
    // frontend, the app and the installer; neither sees the signing key.
    // tauri.conf.json turns off the bundler's own signing
    // (createUpdaterArtifacts).
    let mut data = gen_data::command(root, false);
    util::without_key(&mut data);
    let mut build = util::node_tool("pnpm", root);
    util::without_key(&mut build).args(["--filter", PACKAGE, "tauri", "build"]);
    if options.capture {
        // Not in the dist folder: SHA256SUMS.txt covers everything there.
        let patch = target.join("dist").join("capture.conf.json");
        let resources: Vec<String> = PACK_FILES
            .iter()
            .map(|file| format!("capture-pack/{file}"))
            .collect();
        fs::write(
            &patch,
            serde_json::to_string_pretty(&json!({ "bundle": { "resources": resources } }))?,
        )?;
        build
            .args(["--features", "capture", "--config"])
            .arg(&patch);
    }
    if let Some(path) = &options.config {
        build.arg("--config").arg(path);
    }
    util::run(&mut data)?;
    util::run(&mut build)?;

    let release = target.join("release");
    let setup = format!("{product}_{version}_x64-setup.exe");
    let bundle = release.join("bundle").join("nsis");
    fs::copy(bundle.join(&setup), out.join(&setup))
        .with_context(|| format!("copying {setup} from {}", bundle.display()))?;

    // The exe in target/release is the unpatched one, without the bundler's
    // installer-type marker, which is what the portable build needs.
    let portable = format!("{product}_{version}_x64-portable.zip");
    let pack: Vec<PathBuf> = if options.capture {
        PACK_FILES
            .iter()
            .map(|file| root.join(PACK_DIR).join(file))
            .collect()
    } else {
        Vec::new()
    };
    write_portable_zip(
        &out.join(&portable),
        &release.join(BINARY),
        &pack,
        &product,
        zip_time,
    )?;
    for file in [&setup, &portable] {
        sign(root, &key, &version, &out.join(file))?;
    }

    let base = options
        .base_url
        .clone()
        .unwrap_or_else(|| format!("{repo}/releases/download/v{version}/"));
    let page = match &options.base_url {
        Some(base) => base.clone(),
        None => format!("{repo}/releases/tag/v{version}"),
    };
    let latest = json!({
        "version": version,
        "notes": notes,
        "pub_date": pub_date,
        // Our own field: the portable build opens this page instead of installing.
        "page": page,
        "platforms": {
            "windows-x86_64": {
                "signature": read_signature(&out.join(format!("{setup}.sig")))?,
                "url": format!("{base}{setup}"),
            },
            "windows-x86_64-portable": {
                "signature": read_signature(&out.join(format!("{portable}.sig")))?,
                "url": format!("{base}{portable}"),
            },
        },
    });
    fs::write(
        out.join("latest.json"),
        serde_json::to_string_pretty(&latest)? + "\n",
    )?;

    write_sums(&out)?;
    println!("dist: {}", out.display());
    Ok(())
}

/// The private key text, read before the long build so a missing key fails
/// early. `tauri signer sign` takes only the text in
/// `TAURI_SIGNING_PRIVATE_KEY`, so a path is read here; the key is passed on
/// through the environment and never printed.
fn signing_key() -> Result<String> {
    let from_file = |path: &Path| {
        fs::read_to_string(path)
            .map(|key| key.trim().to_owned())
            .with_context(|| format!("reading the signing key at {}", path.display()))
    };
    // An unset GitHub secret arrives as an empty variable.
    let set = |name| std::env::var_os(name).filter(|value| !value.is_empty());
    if let Some(value) = set("TAURI_SIGNING_PRIVATE_KEY") {
        let path = PathBuf::from(&value);
        if path.is_file() {
            return from_file(&path);
        }
        return value
            .into_string()
            .map_err(|_| anyhow::anyhow!("TAURI_SIGNING_PRIVATE_KEY is not valid text"));
    }
    if let Some(path) = set("TAURI_SIGNING_PRIVATE_KEY_PATH") {
        return from_file(Path::new(&path));
    }
    bail!("set TAURI_SIGNING_PRIVATE_KEY (the key or its path) to sign the release")
}

/// Writes `<file>.sig`, bound to the version so the updater can check it
/// (`requireSignedVersion`).
fn sign(root: &Path, key: &str, version: &str, file: &Path) -> Result<()> {
    util::run(
        util::node_tool("pnpm", root)
            .args(["--filter", PACKAGE, "tauri", "signer", "sign"])
            .args(["--app-version", version])
            .arg(file)
            .env("TAURI_SIGNING_PRIVATE_KEY", key)
            .env_remove("TAURI_SIGNING_PRIVATE_KEY_PATH"),
    )
}

/// The commit's time in the committer's time zone, for the zip entries:
/// without it they read 1980-01-01, and a fixed time keeps the zip
/// reproducible. `%cI` looks like `2026-11-15T19:06:12+08:00`.
fn commit_time(root: &Path) -> Result<zip::DateTime> {
    let iso = util::output(util::command("git", root).args(["log", "-1", "--format=%cI"]))?;
    let iso = iso.trim();
    let bad = || format!("unexpected commit date `{iso}`");
    let year = iso
        .get(0..4)
        .and_then(|s| s.parse().ok())
        .with_context(bad)?;
    let field = |range| -> Result<u8> {
        iso.get(range)
            .and_then(|s: &str| s.parse().ok())
            .with_context(bad)
    };
    zip::DateTime::from_date_and_time(
        year,
        field(5..7)?,
        field(8..10)?,
        field(11..13)?,
        field(14..16)?,
        field(17..19)?,
    )
    .with_context(bad)
}

fn read_json(path: &Path) -> Result<Value> {
    let text = fs::read_to_string(path).with_context(|| format!("reading {}", path.display()))?;
    serde_json::from_str(&text).with_context(|| format!("parsing {}", path.display()))
}

/// JSON merge patch (RFC 7396), the way `tauri build --config` merges.
fn merge(base: &mut Value, patch: Value) {
    match (base, patch) {
        (Value::Object(base), Value::Object(patch)) => {
            for (key, value) in patch {
                if value.is_null() {
                    base.remove(&key);
                } else {
                    merge(base.entry(key).or_insert(Value::Null), value);
                }
            }
        }
        (base, patch) => *base = patch,
    }
}

fn target_dir(root: &Path) -> Result<PathBuf> {
    let metadata = util::output(util::cargo(root).args([
        "metadata",
        "--locked",
        "--no-deps",
        "--format-version",
        "1",
    ]))?;
    let metadata: Value = serde_json::from_str(&metadata)?;
    metadata["target_directory"]
        .as_str()
        .map(PathBuf::from)
        .context("cargo metadata has no target_directory")
}

/// The capture pack, built before the app so the bundler finds it.
#[cfg(feature = "capture")]
fn build_pack(root: &Path) -> Result<()> {
    crate::pack::run(root)
}

#[cfg(not(feature = "capture"))]
fn build_pack(_root: &Path) -> Result<()> {
    bail!(
        "this xtask was built without `capture`: run `cargo xtask dist` (the alias has it), or add --no-capture"
    )
}

fn write_portable_zip(
    path: &Path,
    exe: &Path,
    pack: &[PathBuf],
    product: &str,
    time: zip::DateTime,
) -> Result<()> {
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .last_modified_time(time);
    let mut zip = ZipWriter::new(BufWriter::new(File::create(path)?));
    zip.start_file(format!("{product}/{product}.exe"), options)?;
    zip.write_all(&fs::read(exe).with_context(|| format!("reading {}", exe.display()))?)?;
    for file in pack {
        let name = file
            .file_name()
            .and_then(|name| name.to_str())
            .context("a pack file name")?;
        zip.start_file(format!("{product}/capture-pack/{name}"), options)?;
        zip.write_all(&fs::read(file).with_context(|| format!("reading {}", file.display()))?)?;
    }
    zip.start_file(format!("{product}/{PORTABLE_MARKER}"), options)?;
    zip.write_all(MARKER_TEXT.as_bytes())?;
    zip.finish()?.flush()?;
    Ok(())
}

fn read_signature(path: &Path) -> Result<String> {
    let signature =
        fs::read_to_string(path).with_context(|| format!("reading {}", path.display()))?;
    Ok(signature.trim().to_owned())
}

/// The version's section of the Chinese changelog, which the app shows next to
/// its Chinese UI; test builds of an unreleased version fall back to Unreleased.
fn release_notes(root: &Path, version: &str) -> Result<String> {
    let text = fs::read_to_string(root.join(changelog::FILE_ZH))?;
    let parsed =
        util::parse_version(version).with_context(|| format!("`{version}` is not X.Y.Z"))?;
    let wanted = Heading::Release {
        version: parsed,
        date: String::new(),
    };
    changelog::section(&text, &wanted)
        .or_else(|| changelog::section(&text, &Heading::Unreleased))
        .with_context(|| {
            format!(
                "{} has neither this version nor Unreleased",
                changelog::FILE_ZH
            )
        })
}

fn write_sums(out: &Path) -> Result<()> {
    let mut names: Vec<String> = fs::read_dir(out)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| name != SUMS)
        .collect();
    names.sort();
    let mut sums = String::new();
    for name in names {
        let digest = Sha256::digest(fs::read(out.join(&name))?);
        let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
        sums.push_str(&format!("{hex}  {name}\n"));
    }
    fs::write(out.join(SUMS), sums)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merge_follows_json_merge_patch() {
        let mut base = json!({"a": 1, "b": {"c": 2, "d": 3}, "e": [1]});
        merge(
            &mut base,
            json!({"b": {"c": 20, "d": null}, "e": [2], "f": "new"}),
        );
        assert_eq!(base, json!({"a": 1, "b": {"c": 20}, "e": [2], "f": "new"}));
    }
}
