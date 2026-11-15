// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Reading and editing `CHANGELOG.md` in the Keep a Changelog 1.1.0 layout.

use std::fs;
use std::path::Path;

use anyhow::{Context, Result, bail};

use crate::util::parse_version;

pub const FILE: &str = "CHANGELOG.md";
const UNRELEASED: &str = "Unreleased";
const SECTIONS: [&str; 6] = [
    "Added",
    "Changed",
    "Deprecated",
    "Removed",
    "Fixed",
    "Security",
];

pub type Version = (u64, u64, u64);

#[derive(Debug, PartialEq, Eq)]
pub enum Heading {
    Unreleased,
    Release { version: Version, date: String },
}

/// Parses a `## ...` line. Returns `None` for lines that are not level-2
/// headings and an error for level-2 headings in the wrong shape.
fn parse_heading(line: &str) -> Option<Result<Heading, String>> {
    let rest = line.strip_prefix("## ")?;
    let parsed = (|| {
        let (name, tail) = rest
            .strip_prefix('[')
            .and_then(|r| r.split_once(']'))
            .ok_or("expected `## [X.Y.Z] - YYYY-MM-DD` or `## [Unreleased]`")?;
        if name == UNRELEASED {
            return if tail.is_empty() {
                Ok(Heading::Unreleased)
            } else {
                Err("`## [Unreleased]` takes no date".to_owned())
            };
        }
        let version = parse_version(name).ok_or("version must be X.Y.Z")?;
        let date = tail
            .strip_prefix(" - ")
            .ok_or("expected ` - YYYY-MM-DD` after the version")?;
        if !is_iso_date(date) {
            return Err("date must be YYYY-MM-DD".to_owned());
        }
        Ok(Heading::Release {
            version,
            date: date.to_owned(),
        })
    })();
    Some(parsed)
}

fn is_iso_date(s: &str) -> bool {
    let b = s.as_bytes();
    let digits =
        |r: std::ops::Range<usize>| b.get(r).is_some_and(|d| d.iter().all(u8::is_ascii_digit));
    if b.len() != 10
        || b[4] != b'-'
        || b[7] != b'-'
        || !digits(0..4)
        || !digits(5..7)
        || !digits(8..10)
    {
        return false;
    }
    let month: u32 = s[5..7].parse().unwrap_or(0);
    let day: u32 = s[8..10].parse().unwrap_or(0);
    (1..=12).contains(&month) && (1..=31).contains(&day)
}

/// A link reference definition such as `[unreleased]: https://...`.
fn is_link_definition(line: &str) -> bool {
    line.starts_with('[') && line.contains("]: ")
}

/// Checks the file against the subset of Keep a Changelog that we rely on.
pub fn validate(text: &str) -> Vec<String> {
    let mut problems = Vec::new();
    let mut lines = text.lines().enumerate();
    if lines.next().map(|(_, l)| l) != Some("# Changelog") {
        problems.push("line 1: expected `# Changelog`".to_owned());
    }
    let mut seen_unreleased = false;
    let mut last_release: Option<Version> = None;
    let mut first_heading = true;
    let mut has_unreleased_link = false;
    for (idx, line) in lines {
        let n = idx + 1;
        if let Some(heading) = parse_heading(line) {
            match heading {
                Err(msg) => problems.push(format!("line {n}: {msg}")),
                Ok(Heading::Unreleased) => {
                    if seen_unreleased {
                        problems.push(format!("line {n}: second `## [Unreleased]`"));
                    } else if !first_heading {
                        problems.push(format!("line {n}: `## [Unreleased]` must come first"));
                    }
                    seen_unreleased = true;
                }
                Ok(Heading::Release { version, .. }) => {
                    if last_release.is_some_and(|prev| version >= prev) {
                        problems.push(format!("line {n}: versions must be listed newest first"));
                    }
                    last_release = Some(version);
                }
            }
            first_heading = false;
        } else if let Some(name) = line.strip_prefix("### ") {
            if !SECTIONS.contains(&name) {
                problems.push(format!(
                    "line {n}: `### {name}` is not one of {}",
                    SECTIONS.join(", ")
                ));
            }
        } else if line.to_ascii_lowercase().starts_with("[unreleased]: ") {
            has_unreleased_link = true;
        }
    }
    if !seen_unreleased {
        problems.push("missing `## [Unreleased]`".to_owned());
    }
    if !has_unreleased_link {
        problems.push("missing the `[unreleased]: ...` link at the bottom".to_owned());
    }
    problems
}

/// The body of one section, without its heading and surrounding blank lines.
pub fn section(text: &str, wanted: &Heading) -> Option<String> {
    let lines: Vec<&str> = text.lines().collect();
    let start = lines.iter().position(|line| match parse_heading(line) {
        Some(Ok(Heading::Release { version, .. })) => {
            matches!(wanted, Heading::Release { version: v, .. } if *v == version)
        }
        Some(Ok(Heading::Unreleased)) => *wanted == Heading::Unreleased,
        _ => false,
    })?;
    // Only the link block at the end of the file closes the last section; a
    // reference-style link inside a section body does not.
    let links = links_start(&lines);
    let body: Vec<&str> = lines[start + 1..links.max(start + 1)]
        .iter()
        .take_while(|line| !line.starts_with("## "))
        .copied()
        .collect();
    Some(body.join("\n").trim_matches('\n').trim_end().to_owned())
}

/// Index of the trailing block made only of link definitions and blank lines.
fn links_start(lines: &[&str]) -> usize {
    let mut start = lines.len();
    for (idx, line) in lines.iter().enumerate().rev() {
        if line.trim().is_empty() || is_link_definition(line) {
            start = idx;
        } else {
            break;
        }
    }
    start
}

/// True when a section body has at least one entry, not just `###` headings.
pub fn has_entries(body: &str) -> bool {
    body.lines()
        .any(|line| !line.trim().is_empty() && !line.starts_with("### "))
}

/// The newest released version, if any.
pub fn latest_release(text: &str) -> Option<Version> {
    text.lines().find_map(|line| match parse_heading(line) {
        Some(Ok(Heading::Release { version, .. })) => Some(version),
        _ => None,
    })
}

/// Moves the Unreleased notes under a new version heading and rewrites the
/// compare links at the bottom.
pub fn release(text: &str, version: Version, date: &str, repo: &str) -> Result<String> {
    let v = fmt_version(version);
    let previous = latest_release(text);
    let mut out = Vec::new();
    let mut moved = false;
    let mut linked = false;
    for line in text.lines() {
        if !moved && parse_heading(line) == Some(Ok(Heading::Unreleased)) {
            out.push(line.to_owned());
            out.push(String::new());
            out.push(format!("## [{v}] - {date}"));
            moved = true;
        } else if line.to_ascii_lowercase().starts_with("[unreleased]: ") {
            out.push(format!("[unreleased]: {repo}/compare/v{v}...HEAD"));
            out.push(match previous {
                Some(prev) => format!("[{v}]: {repo}/compare/v{}...v{v}", fmt_version(prev)),
                None => format!("[{v}]: {repo}/releases/tag/v{v}"),
            });
            linked = true;
        } else {
            out.push(line.to_owned());
        }
    }
    if !moved {
        bail!("no `## [Unreleased]` heading");
    }
    if !linked {
        bail!("no `[unreleased]: ...` link");
    }
    let mut joined = out.join("\n");
    joined.push('\n');
    Ok(joined)
}

pub fn fmt_version((major, minor, patch): Version) -> String {
    format!("{major}.{minor}.{patch}")
}

/// `cargo xtask changelog <X.Y.Z|Unreleased>`
pub fn print_section(root: &Path, which: &str) -> Result<()> {
    let text = fs::read_to_string(root.join(FILE)).with_context(|| format!("reading {FILE}"))?;
    let wanted = if which.eq_ignore_ascii_case(UNRELEASED) {
        Heading::Unreleased
    } else {
        let version = parse_version(which.trim_start_matches('v'))
            .with_context(|| format!("`{which}` is not X.Y.Z or Unreleased"))?;
        Heading::Release {
            version,
            date: String::new(),
        }
    };
    let body = section(&text, &wanted).with_context(|| format!("no section for `{which}`"))?;
    println!("{body}");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const REPO: &str = "https://github.com/owner/repo";

    const EMPTY: &str = "# Changelog\n\nIntro.\n\n## [Unreleased]\n\n\
        [unreleased]: https://github.com/owner/repo/commits/main\n";

    const ONE_RELEASE: &str = "# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Thing.\n\n\
        ## [0.1.0] - 2026-11-20\n\n### Added\n\n- First.\n\n\
        [unreleased]: https://github.com/owner/repo/compare/v0.1.0...HEAD\n\
        [0.1.0]: https://github.com/owner/repo/releases/tag/v0.1.0\n";

    #[test]
    fn a_fresh_changelog_is_valid() {
        assert_eq!(validate(EMPTY), Vec::<String>::new());
        assert_eq!(validate(ONE_RELEASE), Vec::<String>::new());
    }

    #[test]
    fn bad_headings_and_sections_are_reported() {
        let text = "# Changelog\n\n## [0.1.0] - 2026-1-2\n\n### Misc\n\n## [Unreleased]\n";
        let problems = validate(text);
        assert!(problems.iter().any(|p| p.contains("YYYY-MM-DD")));
        assert!(problems.iter().any(|p| p.contains("### Misc")));
        assert!(problems.iter().any(|p| p.contains("must come first")));
        assert!(problems.iter().any(|p| p.contains("[unreleased]")));
    }

    #[test]
    fn versions_must_descend() {
        let text = "# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-11-01\n\n\
            ## [0.2.0] - 2026-11-02\n\n[unreleased]: x\n";
        assert!(validate(text).iter().any(|p| p.contains("newest first")));
    }

    #[test]
    fn sections_stop_at_the_next_heading_or_the_links() {
        assert_eq!(
            section(ONE_RELEASE, &Heading::Unreleased).as_deref(),
            Some("### Fixed\n\n- Thing.")
        );
        let v010 = Heading::Release {
            version: (0, 1, 0),
            date: String::new(),
        };
        assert_eq!(
            section(ONE_RELEASE, &v010).as_deref(),
            Some("### Added\n\n- First.")
        );
        assert_eq!(section(EMPTY, &Heading::Unreleased).as_deref(), Some(""));
    }

    #[test]
    fn reference_links_inside_a_section_do_not_cut_it_short() {
        let text = "# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Crash ([#3]).\n\n\
            [#3]: https://example.invalid/3\n\n- Other fix.\n\n[unreleased]: x\n";
        let body = section(text, &Heading::Unreleased).expect("section");
        assert!(body.ends_with("- Other fix."));
    }

    #[test]
    fn headings_alone_are_not_entries() {
        assert!(!has_entries("### Added\n\n### Fixed"));
        assert!(has_entries("### Added\n\n- Thing."));
    }

    #[test]
    fn the_first_release_links_to_its_tag() {
        let text = EMPTY.replace(
            "## [Unreleased]\n",
            "## [Unreleased]\n\n### Added\n\n- New.\n",
        );
        let out = release(&text, (0, 1, 0), "2026-11-20", REPO).expect("release");
        assert!(out.contains("## [Unreleased]\n\n## [0.1.0] - 2026-11-20\n\n### Added\n\n- New."));
        assert!(
            out.contains("[unreleased]: https://github.com/owner/repo/compare/v0.1.0...HEAD\n")
        );
        assert!(out.contains("[0.1.0]: https://github.com/owner/repo/releases/tag/v0.1.0\n"));
        assert_eq!(validate(&out), Vec::<String>::new());
    }

    #[test]
    fn later_releases_link_to_a_comparison() {
        let out = release(ONE_RELEASE, (0, 2, 0), "2026-12-01", REPO).expect("release");
        assert!(out.contains("## [0.2.0] - 2026-12-01\n\n### Fixed\n\n- Thing."));
        assert!(out.contains("[0.2.0]: https://github.com/owner/repo/compare/v0.1.0...v0.2.0\n"));
        assert!(out.contains("[0.1.0]: https://github.com/owner/repo/releases/tag/v0.1.0\n"));
        assert_eq!(validate(&out), Vec::<String>::new());
    }
}
