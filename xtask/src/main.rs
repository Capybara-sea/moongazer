// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Development and release commands, run as `cargo xtask <command>`.
//!
//! CI workflows only install tools and call `cargo xtask ci <job>`, so every
//! check lives here and runs the same way locally.

#![expect(clippy::print_stdout, clippy::print_stderr, reason = "xtask is a CLI")]

mod changelog;
mod ci;
mod commit_msg;
mod dist;
mod gen_data;
mod guard;
mod icons;
mod notices;
#[cfg(feature = "capture")]
mod pack;
mod release;
mod util;

use std::process::ExitCode;

use anyhow::{Result, bail};

const USAGE: &str = "\
usage: cargo xtask <command>

commands:
  guard [--staged|--all|--all-history]
                                  check files against the repository rules
                                  (--all-history: the leak checks and the license refusal on every
                                  commit, commit message and tag)
  commit-msg <file>               check a commit message
  ci <job>                        run one CI job: guard, fmt, clippy, test, frontend, deny, no-nightly
  check                           run every CI job
  changelog <X.Y.Z|Unreleased>    print one CHANGELOG section
  verify-tag <tag>                check that a tag matches the workspace version
  release <X.Y.Z> [--dry-run]     bump the version, date the changelog, commit and tag
  dist [--config <file>] [--no-capture] [--base-url <url> | --no-sign]
                                  build the signed installer, portable zip, latest.json and checksums
                                  (with auto sync and its capture pack unless --no-capture;
                                  --base-url: where latest.json links to; --no-sign: build only)
  manifest <dir>                  write latest.json and checksums for a build signed elsewhere (CI)
  icons <source>                  regenerate the app icons from the logo (SVG or square PNG)
  gen-data [--update]             generate the game data tables (--update: move the source pins
                                  to the latest upstream commits first)
  notices [--no-capture] [--text <file>]
                                  write the third-party notices the About page shows
                                  (--text: also the plain text shipped with the app)
  pack                            build the capture pack: upstream's keys and a game database
                                  from the pinned AnimeGameData tables
";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("error: {err:#}");
            ExitCode::FAILURE
        }
    }
}

fn run(args: &[String]) -> Result<()> {
    let root = util::repo_root();
    let rest: Vec<&str> = args.iter().skip(1).map(String::as_str).collect();
    match args.first().map(String::as_str) {
        Some("guard") => guard::run(&root, guard::Mode::parse(&rest)?),
        Some("commit-msg") => commit_msg::run(one_arg(&rest, "commit-msg <file>")?),
        Some("ci") => ci::run_job(&root, one_arg(&rest, "ci <job>")?),
        Some("check") => ci::run_all(&root),
        Some("changelog") => {
            changelog::print_section(&root, one_arg(&rest, "changelog <version>")?)
        }
        Some("verify-tag") => release::verify_tag(&root, one_arg(&rest, "verify-tag <tag>")?),
        Some("release") => release::run(&root, &rest),
        Some("dist") => dist::run(&root, &rest),
        Some("manifest") => dist::manifest(&root, one_arg(&rest, "manifest <dir>")?),
        Some("icons") => icons::run(&root, one_arg(&rest, "icons <source>")?),
        Some("gen-data") => match rest.as_slice() {
            [] => gen_data::run(&root, false),
            ["--update"] => gen_data::run(&root, true),
            _ => bail!("usage: cargo xtask gen-data [--update]"),
        },
        Some("notices") => notices::run(&root, &rest),
        #[cfg(feature = "capture")]
        Some("pack") => pack::run(&root),
        Some("help" | "-h" | "--help") | None => {
            print!("{USAGE}");
            Ok(())
        }
        Some(other) => bail!("unknown command `{other}`\n\n{USAGE}"),
    }
}

fn one_arg<'a>(rest: &[&'a str], usage: &str) -> Result<&'a str> {
    match rest {
        [arg] => Ok(arg),
        _ => bail!("usage: cargo xtask {usage}"),
    }
}
