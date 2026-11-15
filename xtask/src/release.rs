// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! `cargo xtask release` and `cargo xtask verify-tag`.
//!
//! A release is a local commit plus an annotated tag. Pushing is left to the
//! user.

use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::process::Stdio;

use anyhow::{Context, Result, bail};

use crate::changelog::{self, Heading};
use crate::{ci, guard, util};

pub fn verify_tag(root: &Path, tag: &str) -> Result<()> {
    let manifest = read_manifest(root)?;
    let version =
        guard::workspace_version(&manifest).context("missing [workspace.package] version")?;
    let expected = format!("v{version}");
    let tag = tag.trim_start_matches("refs/tags/");
    if tag != expected {
        bail!("tag `{tag}` does not match the workspace version (expected `{expected}`)");
    }
    println!("tag {tag} matches the workspace version");
    Ok(())
}

pub fn run(root: &Path, args: &[&str]) -> Result<()> {
    let (version_arg, dry_run) = match args {
        [v] => (*v, false),
        [v, "--dry-run"] | ["--dry-run", v] => (*v, true),
        _ => bail!("usage: cargo xtask release <X.Y.Z> [--dry-run]"),
    };
    let version = util::parse_version(version_arg)
        .with_context(|| format!("`{version_arg}` is not X.Y.Z"))?;
    let v = changelog::fmt_version(version);

    let mut manifest = read_manifest(root)?;
    let current = guard::workspace_version(&manifest)
        .context("missing [workspace.package] version")?
        .to_owned();
    let repo = manifest
        .get("workspace")
        .and_then(|w| w.get("package"))
        .and_then(|p| p.get("repository"))
        .and_then(toml_edit::Item::as_str)
        .context("missing [workspace.package] repository")?
        .trim_end_matches('/')
        .to_owned();
    let changelog_path = root.join(changelog::FILE);
    let text = fs::read_to_string(&changelog_path).context("reading CHANGELOG.md")?;
    let date = util::today(root)?;
    let new_text = changelog::release(&text, version, &date, &repo)?;

    let blockers = blockers(root, version, &current, &text, &new_text)?;

    if dry_run {
        println!("release {v} (dry run, nothing is written)");
        println!("  Cargo.toml: [workspace.package] version {current} -> {v}");
        println!("  Cargo.lock: cargo update --workspace");
        println!("  {}:", changelog::FILE);
        for line in diff_lines(&text, &new_text) {
            println!("    {line}");
        }
        println!("  before writing: cargo xtask check");
        println!("  commit: Release {v}");
        println!("  tag: v{v} (annotated, not pushed)");
        if blockers.is_empty() {
            println!("no blockers");
            return Ok(());
        }
        for blocker in &blockers {
            println!("would refuse: {blocker}");
        }
        bail!(
            "the release would be refused ({} blocker(s))",
            blockers.len()
        );
    }

    if !blockers.is_empty() {
        for blocker in &blockers {
            eprintln!("release: {blocker}");
        }
        bail!("release refused");
    }

    ci::run_all(root)?;

    let mut originals = Vec::new();
    for file in RELEASE_FILES {
        let bytes = fs::read(root.join(file)).with_context(|| format!("reading {file}"))?;
        originals.push((file, bytes));
    }
    if let Err(err) = write_and_commit(root, &mut manifest, &v, &new_text) {
        if let Err(restore_err) = restore(root, &originals) {
            bail!(
                "{err:#}\nrestoring the release files also failed: {restore_err:#}\n\
                 run `git restore --staged --worktree {}`",
                RELEASE_FILES.join(" ")
            );
        }
        return Err(err.context("release failed; the release files were restored"));
    }

    let tag = format!("v{v}");
    util::run(util::command("git", root).args(["tag", "-a", &tag, "-m", &tag])).with_context(
        || format!("the release commit exists but tagging failed; tag it with `git tag -a {tag}`"),
    )?;
    println!("released {v}: commit and tag {tag} created locally; nothing was pushed");
    Ok(())
}

const RELEASE_FILES: [&str; 3] = ["Cargo.toml", "Cargo.lock", changelog::FILE];

fn write_and_commit(
    root: &Path,
    manifest: &mut toml_edit::DocumentMut,
    v: &str,
    new_changelog: &str,
) -> Result<()> {
    let slot = manifest
        .get_mut("workspace")
        .and_then(|w| w.get_mut("package"))
        .and_then(|p| p.get_mut("version"))
        .context("missing [workspace.package] version")?;
    let decor = slot.as_value().map(|value| value.decor().clone());
    *slot = toml_edit::value(v);
    if let (Some(decor), Some(value)) = (decor, slot.as_value_mut()) {
        *value.decor_mut() = decor;
    }
    fs::write(root.join("Cargo.toml"), manifest.to_string()).context("writing Cargo.toml")?;
    util::run(util::cargo(root).args(["update", "--workspace"]))?;
    fs::write(root.join(changelog::FILE), new_changelog).context("writing CHANGELOG.md")?;
    util::run(util::command("git", root).arg("add").args(RELEASE_FILES))?;
    // The commit runs the pre-commit and commit-msg hooks.
    util::run(util::command("git", root).args(["commit", "-m", &format!("Release {v}")]))
}

fn restore(root: &Path, originals: &[(&str, Vec<u8>)]) -> Result<()> {
    for (file, bytes) in originals {
        fs::write(root.join(file), bytes).with_context(|| format!("restoring {file}"))?;
    }
    util::run(
        util::command("git", root)
            .args(["restore", "--staged"])
            .args(RELEASE_FILES),
    )
}

fn read_manifest(root: &Path) -> Result<toml_edit::DocumentMut> {
    fs::read_to_string(root.join("Cargo.toml"))
        .context("reading Cargo.toml")?
        .parse()
        .context("parsing Cargo.toml")
}

fn blockers(
    root: &Path,
    version: changelog::Version,
    current: &str,
    text: &str,
    new_text: &str,
) -> Result<Vec<String>> {
    let v = changelog::fmt_version(version);
    let mut out = Vec::new();
    match util::parse_version(current) {
        Some(cur) if version <= cur => {
            out.push(format!("{v} is not newer than the current {current}"))
        }
        Some(_) => {}
        None => out.push(format!("the current version `{current}` is not X.Y.Z")),
    }
    if let Some(latest) = changelog::latest_release(text)
        && version <= latest
    {
        out.push(format!(
            "{v} is not newer than {} in CHANGELOG.md",
            changelog::fmt_version(latest)
        ));
    }
    for problem in changelog::validate(new_text) {
        out.push(format!(
            "the updated CHANGELOG.md would be invalid: {problem}"
        ));
    }
    let tag_exists = util::command("git", root)
        .args(["rev-parse", "-q", "--verify", &format!("refs/tags/v{v}")])
        .stdout(Stdio::null())
        .status()
        .context("running git rev-parse")?
        .success();
    if tag_exists {
        out.push(format!("tag v{v} already exists"));
    }
    match changelog::section(text, &Heading::Unreleased) {
        None => out.push("CHANGELOG.md has no Unreleased section".to_owned()),
        Some(body) if !changelog::has_entries(&body) => {
            out.push("the Unreleased section has no entries".to_owned())
        }
        Some(_) => {}
    }
    let status = util::output(util::command("git", root).args(["status", "--porcelain"]))?;
    if !status.trim().is_empty() {
        out.push("the working tree has uncommitted changes".to_owned());
    }
    let branch =
        util::output(util::command("git", root).args(["rev-parse", "--abbrev-ref", "HEAD"]))?;
    if branch.trim() != "main" {
        out.push(format!("on branch `{}`, not main", branch.trim()));
    }
    Ok(out)
}

/// Lines removed and added, in file order. Enough for a changelog edit that
/// only inserts a heading and rewrites the links.
fn diff_lines(old: &str, new: &str) -> Vec<String> {
    let old_set: HashSet<&str> = old.lines().collect();
    let new_set: HashSet<&str> = new.lines().collect();
    let removed = old
        .lines()
        .filter(|l| !new_set.contains(l))
        .map(|l| format!("- {l}"));
    let added = new
        .lines()
        .filter(|l| !old_set.contains(l))
        .map(|l| format!("+ {l}"));
    removed.chain(added).collect()
}
