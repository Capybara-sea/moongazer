// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! `cargo xtask dist`: the signed NSIS installer, the signed portable zip,
//! `latest.json`, `SHA256SUMS.txt` and the third-party notices, all in
//! `<target>/dist/v<version>/`. The installer and the zip hold only the exe
//! (and the zip its portable marker): the notices are on the About page.
//!
//! Signing reads `TAURI_SIGNING_PRIVATE_KEY` (the key, or a path to it) or
//! `TAURI_SIGNING_PRIVATE_KEY_PATH`, and for a key with a password,
//! `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The private key never lives in the
//! repository. The build runs scripts from hundreds of npm and Rust packages,
//! so it runs in a child xtask without these variables; only
//! `tauri signer sign` gets the key.
//!
//! `--no-sign` only builds. CI builds that way in a job without the key, signs
//! in another job and then writes latest.json and the checksums with
//! `cargo xtask manifest <dir>`.
//!
//! `--config <file>` is merged into tauri.conf.json like the Tauri CLI's own
//! flag (test builds use it for a local endpoint and version). `--base-url`
//! points the download links in latest.json somewhere other than the GitHub
//! release.
//!
//! The build has auto sync: it runs `pack` first, and build.rs builds the
//! capture pack into the exe. `--no-capture` builds without it (hard rule:
//! a build without capture must always be possible).

use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use zip::CompressionMethod;
use zip::write::{SimpleFileOptions, ZipWriter};

use crate::changelog::{self, Heading};
use crate::{gen_data, guard, notices, util};

const PACKAGE: &str = "@moongazer/desktop";
const TAURI_CONF: &str = "apps/desktop/src-tauri/tauri.conf.json";
/// `build.frontendDist` in tauri.conf.json.
const FRONTEND_DIST: &str = "apps/desktop/dist";
const BINARY: &str = "moongazer.exe";
/// Must match `MARKER` in apps/desktop/src-tauri/src/portable.rs.
const PORTABLE_MARKER: &str = "portable";
const MARKER_TEXT: &str = "This file makes Moongazer portable: its settings, data, logs and \
                           webview data stay in the app-data folder next to it.\r\n";
const SUMS: &str = "SHA256SUMS.txt";
const NOTICES: &str = "THIRD_PARTY_NOTICES.txt";

struct Options {
    config: Option<PathBuf>,
    base_url: Option<String>,
    capture: bool,
    sign: bool,
}

fn parse(args: &[&str]) -> Result<Options> {
    let mut options = Options {
        config: None,
        base_url: None,
        capture: true,
        sign: true,
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
            "--no-sign" => options.sign = false,
            other => {
                bail!(
                    "usage: cargo xtask dist [--config <file>] [--no-capture] [--base-url <url> | --no-sign]; got `{other}`"
                )
            }
        }
    }
    if !options.sign && options.base_url.is_some() {
        bail!("--base-url is for latest.json, which --no-sign does not write");
    }
    Ok(options)
}

/// What the file names and latest.json take from tauri.conf.json (merged
/// with `--config`) and the root Cargo.toml.
struct Release {
    product: String,
    version: String,
    repo: String,
}

impl Release {
    fn load(root: &Path, config: Option<&Path>) -> Result<Self> {
        let mut conf = read_json(&root.join(TAURI_CONF))?;
        if let Some(path) = config {
            merge(&mut conf, read_json(path)?);
        }
        if conf
            .pointer("/plugins/updater/pubkey")
            .and_then(Value::as_str)
            .is_none_or(str::is_empty)
        {
            bail!(
                "plugins.updater.pubkey is empty; generate the signing key and add its public key first"
            );
        }
        let product = conf["productName"]
            .as_str()
            .context("tauri.conf.json has no productName")?
            .to_owned();
        let manifest: toml_edit::DocumentMut =
            fs::read_to_string(root.join("Cargo.toml"))?.parse()?;
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
        Ok(Self {
            product,
            version,
            repo,
        })
    }

    fn out_dir(&self, target: &Path) -> PathBuf {
        target.join("dist").join(format!("v{}", self.version))
    }

    fn setup(&self) -> String {
        format!("{}_{}_x64-setup.exe", self.product, self.version)
    }

    fn portable(&self) -> String {
        format!("{}_{}_x64-portable.zip", self.product, self.version)
    }
}

pub fn run(root: &Path, args: &[&str]) -> Result<()> {
    let options = parse(args)?;
    let release = Release::load(root, options.config.as_deref())?;
    if !options.sign {
        return build(root, &options, &release);
    }
    // Everything that can fail cheaply goes before the long build.
    let key = signing_key()?;
    let notes = release_notes(root, &release.version)?;
    let mut child = util::command(std::env::current_exe().context("finding xtask")?, root);
    util::without_key(&mut child).args(["dist", "--no-sign"]);
    if !options.capture {
        child.arg("--no-capture");
    }
    if let Some(path) = &options.config {
        child.arg("--config").arg(path);
    }
    util::run(&mut child)?;
    let out = release.out_dir(&target_dir(root)?);
    for file in [release.setup(), release.portable()] {
        sign(root, &key, &release.version, &out.join(file))?;
    }
    write_manifest(&out, &release, &notes, options.base_url.as_deref())?;
    println!("dist: {}", out.display());
    Ok(())
}

/// `cargo xtask manifest <dir>`: latest.json and SHA256SUMS.txt for the
/// installer and the zip in `dir`, once both are signed.
pub fn manifest(root: &Path, dir: &str) -> Result<()> {
    let release = Release::load(root, None)?;
    let notes = release_notes(root, &release.version)?;
    write_manifest(Path::new(dir), &release, &notes, None)?;
    println!("manifest: {dir}");
    Ok(())
}

fn build(root: &Path, options: &Options, release: &Release) -> Result<()> {
    let zip_time = commit_time(root)?;
    let target = target_dir(root)?;
    if options.capture {
        build_pack(root)?;
    }
    let out = release.out_dir(&target);
    if out.exists() {
        fs::remove_dir_all(&out).with_context(|| format!("clearing {}", out.display()))?;
    }
    fs::create_dir_all(&out)?;

    // The data generator downloads files, and the frontend and Tauri builds
    // run package scripts; none of them sees the signing key.
    // tauri.conf.json turns off the bundler's own signing
    // (createUpdaterArtifacts).
    util::run(util::without_key(&mut gen_data::command(root, false)))?;
    notices::write_app_json(root, options.capture)?;
    util::run(
        util::without_key(&mut util::node_tool("pnpm", root))
            .args(["--filter", PACKAGE, "run", "build"]),
    )?;
    let notices_file = out.join(NOTICES);
    notices::write_text(
        root,
        options.capture,
        &root.join(FRONTEND_DIST),
        &notices_file,
    )?;
    // Not in the dist folder: SHA256SUMS.txt covers everything there.
    let patch = target.join("dist").join("bundle.conf.json");
    fs::write(&patch, serde_json::to_string_pretty(&bundle_patch())?)?;
    let mut tauri = util::node_tool("pnpm", root);
    util::without_key(&mut tauri)
        .args(["--filter", PACKAGE, "tauri", "build", "--config"])
        .arg(&patch);
    if options.capture {
        tauri.args(["--features", "capture"]);
    }
    if let Some(path) = &options.config {
        tauri.arg("--config").arg(path);
    }
    util::run(&mut tauri)?;

    let release_dir = target.join("release");
    let setup = release.setup();
    let bundle = release_dir.join("bundle").join("nsis");
    fs::copy(bundle.join(&setup), out.join(&setup))
        .with_context(|| format!("copying {setup} from {}", bundle.display()))?;

    // The exe in target/release is the unpatched one, without the bundler's
    // installer-type marker, which is what the portable build needs.
    write_portable_zip(
        &out.join(release.portable()),
        &release_dir.join(BINARY),
        &release.product,
        zip_time,
    )?;
    println!("dist (unsigned): {}", out.display());
    Ok(())
}

/// The `tauri build --config` patch. The frontend is built already: the
/// notices text reads what its build wrote.
fn bundle_patch() -> Value {
    json!({ "build": { "beforeBuildCommand": "" } })
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
/// (`requireSignedVersion`). release.yml signs with the same command.
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

/// latest.json and SHA256SUMS.txt for the signed installer and zip in `out`.
fn write_manifest(
    out: &Path,
    release: &Release,
    notes: &str,
    base_url: Option<&str>,
) -> Result<()> {
    let signature = |file: String| read_signature(&out.join(format!("{file}.sig")));
    let signatures = [signature(release.setup())?, signature(release.portable())?];
    let latest = latest_json(release, notes, &util::now_rfc3339()?, base_url, signatures);
    fs::write(
        out.join("latest.json"),
        serde_json::to_string_pretty(&latest)? + "\n",
    )?;
    write_sums(out)
}

fn latest_json(
    release: &Release,
    notes: &str,
    pub_date: &str,
    base_url: Option<&str>,
    [setup_signature, portable_signature]: [String; 2],
) -> Value {
    let Release { repo, version, .. } = release;
    let base = base_url.map_or_else(
        || format!("{repo}/releases/download/v{version}/"),
        str::to_owned,
    );
    let page = base_url.map_or_else(|| format!("{repo}/releases/tag/v{version}"), str::to_owned);
    json!({
        "version": version,
        "notes": notes,
        "pub_date": pub_date,
        // Our own field: a portable build that cannot write to its folder
        // opens this page instead of replacing itself.
        "page": page,
        "platforms": {
            "windows-x86_64": {
                "signature": setup_signature,
                "url": format!("{base}{}", release.setup()),
            },
            "windows-x86_64-portable": {
                "signature": portable_signature,
                "url": format!("{base}{}", release.portable()),
            },
        },
    })
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

/// The capture pack, written before the app is built so build.rs builds it in.
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

fn write_portable_zip(path: &Path, exe: &Path, product: &str, time: zip::DateTime) -> Result<()> {
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .last_modified_time(time);
    let mut zip = ZipWriter::new(BufWriter::new(File::create(path)?));
    zip.start_file(format!("{product}/{product}.exe"), options)?;
    zip.write_all(&fs::read(exe).with_context(|| format!("reading {}", exe.display()))?)?;
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

    fn release() -> Release {
        Release {
            product: "Moongazer".to_owned(),
            version: "1.2.3".to_owned(),
            repo: "https://github.com/o/r".to_owned(),
        }
    }

    #[test]
    fn merge_follows_json_merge_patch() {
        let mut base = json!({"a": 1, "b": {"c": 2, "d": 3}, "e": [1]});
        merge(
            &mut base,
            json!({"b": {"c": 20, "d": null}, "e": [2], "f": "new"}),
        );
        assert_eq!(base, json!({"a": 1, "b": {"c": 20}, "e": [2], "f": "new"}));
    }

    #[test]
    fn options_parse_and_base_url_needs_signing() {
        let options = parse(&["--no-capture", "--base-url", "http://127.0.0.1:8000"]).unwrap();
        assert!(!options.capture && options.sign);
        assert_eq!(options.base_url.as_deref(), Some("http://127.0.0.1:8000/"));
        let options = parse(&["--no-sign"]).unwrap();
        assert!(options.capture && !options.sign && options.base_url.is_none());
        assert!(parse(&["--no-sign", "--base-url", "http://127.0.0.1:8000"]).is_err());
        assert!(parse(&["--config"]).is_err());
        assert!(parse(&["--sign"]).is_err());
    }

    #[test]
    fn latest_json_points_each_build_at_its_release_file() {
        let signatures = ["setup sig".to_owned(), "zip sig".to_owned()];
        let latest = latest_json(
            &release(),
            "notes",
            "2026-01-02T03:04:05Z",
            None,
            signatures,
        );
        let base = "https://github.com/o/r/releases/download/v1.2.3/";
        assert_eq!(latest["version"], "1.2.3");
        assert_eq!(latest["notes"], "notes");
        assert_eq!(latest["pub_date"], "2026-01-02T03:04:05Z");
        assert_eq!(latest["page"], "https://github.com/o/r/releases/tag/v1.2.3");
        assert_eq!(
            latest["platforms"],
            json!({
                "windows-x86_64": {
                    "signature": "setup sig",
                    "url": format!("{base}Moongazer_1.2.3_x64-setup.exe"),
                },
                "windows-x86_64-portable": {
                    "signature": "zip sig",
                    "url": format!("{base}Moongazer_1.2.3_x64-portable.zip"),
                },
            })
        );
        let local = latest_json(
            &release(),
            "",
            "",
            Some("http://127.0.0.1:8000/"),
            [String::new(), String::new()],
        );
        assert_eq!(local["page"], "http://127.0.0.1:8000/");
        assert_eq!(
            local["platforms"]["windows-x86_64-portable"]["url"],
            "http://127.0.0.1:8000/Moongazer_1.2.3_x64-portable.zip"
        );
    }

    #[test]
    fn the_portable_zip_keeps_everything_in_one_folder() {
        let dir = std::env::temp_dir().join(format!("xtask-zip-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let file = |name: &str| {
            let path = dir.join(name);
            fs::write(&path, name).unwrap();
            path
        };
        let zip_path = dir.join("p.zip");
        let time = zip::DateTime::from_date_and_time(2026, 1, 2, 3, 4, 5).unwrap();
        write_portable_zip(&zip_path, &file("app.exe"), "P", time).unwrap();
        let archive = zip::ZipArchive::new(File::open(&zip_path).unwrap()).unwrap();
        let mut names: Vec<String> = archive
            .file_names()
            .map(|name| name.unwrap().into_owned())
            .collect();
        names.sort();
        assert_eq!(names, ["P/P.exe", "P/portable"]);
        fs::remove_dir_all(&dir).unwrap();
    }
}
