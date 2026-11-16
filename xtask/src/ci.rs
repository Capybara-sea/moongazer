// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! CI jobs. `cargo xtask check` runs all of them in order.

use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use serde_json::Value;

use crate::{gen_data, guard, util};

pub const JOBS: [&str; 7] = [
    "guard",
    "fmt",
    "clippy",
    "test",
    "frontend",
    "deny",
    "no-nightly",
];

/// Directories whose children may be pnpm workspace packages; keep in sync
/// with `pnpm-workspace.yaml`.
const PACKAGE_DIRS: [&str; 3] = ["apps", "tools", "packages"];

pub fn run_all(root: &Path) -> Result<()> {
    for job in JOBS {
        println!("\n==> {job}");
        run_job(root, job)?;
    }
    println!("\nall checks passed");
    Ok(())
}

pub fn run_job(root: &Path, job: &str) -> Result<()> {
    match job {
        "guard" => guard::run(root, guard::Mode::All),
        "fmt" => util::run(util::cargo(root).args(["fmt", "--all", "--check"])),
        "clippy" => for_feature_sets(root, |features| {
            util::run(
                util::cargo(root)
                    .args(["clippy", "--locked", "--workspace", "--all-targets"])
                    .args(features)
                    .args(["--", "-D", "warnings"]),
            )
        }),
        "test" => for_feature_sets(root, |features| {
            util::run(
                util::cargo(root)
                    .args(["test", "--locked", "--workspace"])
                    .args(features),
            )
        }),
        "frontend" => frontend(root),
        "deny" => util::run(
            util::cargo(root).args(["deny", "--locked", "check", "licenses", "bans", "sources"]),
        ),
        "no-nightly" => no_nightly(root),
        // Weekly in CI and not part of `check`: a newly published advisory
        // should not block unrelated work.
        "advisories" => {
            util::run(util::cargo(root).args(["deny", "--locked", "check", "advisories"]))
        }
        other => bail!(
            "unknown job `{other}`; jobs: {}, advisories",
            JOBS.join(", ")
        ),
    }
}

/// Runs once with default features and, when a member defines `capture`, once
/// more with it. `capture` stays out of every `default` feature list, so the
/// first run is always the build without capture, which must keep working.
fn for_feature_sets(root: &Path, mut run: impl FnMut(&[&str]) -> Result<()>) -> Result<()> {
    run(&[])?;
    if has_capture_feature(root)? {
        run(&["--features", "capture"])?;
    } else {
        println!("(no member defines `capture` yet; skipped the capture build)");
    }
    Ok(())
}

fn has_capture_feature(root: &Path) -> Result<bool> {
    let metadata = util::output(util::cargo(root).args([
        "metadata",
        "--locked",
        "--no-deps",
        "--format-version",
        "1",
    ]))?;
    let metadata: Value = serde_json::from_str(&metadata).context("parsing cargo metadata")?;
    Ok(metadata["packages"]
        .as_array()
        .into_iter()
        .flatten()
        .any(|package| package["features"].get("capture").is_some()))
}

fn frontend(root: &Path) -> Result<()> {
    if !root.join("node_modules").is_dir() {
        bail!("node_modules is missing; run `pnpm install --frozen-lockfile` first");
    }
    util::run(util::node_tool("pnpm", root).args(["exec", "biome", "ci", "."]))?;
    if workspace_packages(root)?.is_empty() {
        println!("(no pnpm workspace packages yet; skipped typecheck, test and build)");
        return Ok(());
    }
    // The frontend imports the generated name table, which is not in git.
    gen_data::run(root, false)?;
    for script in ["typecheck", "test", "build"] {
        util::run(util::node_tool("pnpm", root).args(["-r", "run", "--if-present", script]))?;
    }
    Ok(())
}

fn workspace_packages(root: &Path) -> Result<Vec<PathBuf>> {
    let mut packages = Vec::new();
    for dir in PACKAGE_DIRS {
        let Ok(children) = fs::read_dir(root.join(dir)) else {
            continue;
        };
        for child in children {
            let path = child.context("listing workspace packages")?.path();
            if path.join("package.json").is_file() {
                packages.push(path);
            }
        }
    }
    Ok(packages)
}

fn no_nightly(root: &Path) -> Result<()> {
    let list = util::output(util::command("rustup", root).args(["toolchain", "list"]))?;
    let nightly: Vec<&str> = list
        .lines()
        .filter(|line| line.contains("nightly"))
        .collect();
    if !nightly.is_empty() {
        bail!("a nightly toolchain is installed: {}", nightly.join(", "));
    }
    println!("no nightly toolchain installed");
    Ok(())
}
