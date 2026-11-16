// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

use std::env;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result, bail};

/// The repository root: the parent of this crate's manifest directory.
pub fn repo_root() -> PathBuf {
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest.parent().unwrap_or(manifest).to_path_buf()
}

/// A command that runs in the repository root.
///
/// Every child gets `RUSTUP_AUTO_INSTALL=0`, and `RUSTUP_TOOLCHAIN=stable`
/// unless the caller already chose a toolchain (CI pins an exact version).
/// This keeps a dependency's `rust-toolchain.toml` from installing nightly.
pub fn command(program: impl AsRef<OsStr>, root: &Path) -> Command {
    let mut cmd = Command::new(program);
    cmd.current_dir(root).env("RUSTUP_AUTO_INSTALL", "0");
    if env::var_os("RUSTUP_TOOLCHAIN").is_none() {
        cmd.env("RUSTUP_TOOLCHAIN", "stable");
    }
    cmd
}

/// The cargo that is running this xtask, falling back to the one on PATH.
pub fn cargo(root: &Path) -> Command {
    command(env::var_os("CARGO").unwrap_or_else(|| "cargo".into()), root)
}

/// A Node tool such as `pnpm`. On Windows these are often `.cmd` shims, which
/// `Command::new` does not find without the extension.
pub fn node_tool(name: &str, root: &Path) -> Command {
    if cfg!(windows) {
        for ext in ["exe", "cmd"] {
            let file = format!("{name}.{ext}");
            if find_on_path(&file).is_some() {
                return command(file, root);
            }
        }
    }
    command(name, root)
}

fn find_on_path(file: &str) -> Option<PathBuf> {
    let paths = env::var_os("PATH")?;
    env::split_paths(&paths)
        .map(|dir| dir.join(file))
        .find(|candidate| candidate.is_file())
}

/// Runs a command with inherited output and fails on a non-zero exit.
pub fn run(cmd: &mut Command) -> Result<()> {
    println!("$ {}", describe(cmd));
    let status = cmd
        .status()
        .with_context(|| format!("failed to start `{}`", describe(cmd)))?;
    if !status.success() {
        bail!("`{}` failed ({status})", describe(cmd));
    }
    Ok(())
}

/// Runs a command and returns its stdout. Fails on a non-zero exit.
pub fn output(cmd: &mut Command) -> Result<String> {
    let out = cmd
        .output()
        .with_context(|| format!("failed to start `{}`", describe(cmd)))?;
    if !out.status.success() {
        bail!(
            "`{}` failed ({}): {}",
            describe(cmd),
            out.status,
            String::from_utf8_lossy(&out.stderr).trim()
        );
    }
    String::from_utf8(out.stdout).with_context(|| format!("`{}` printed non-UTF-8", describe(cmd)))
}

/// Runs a command and returns its raw stdout. Fails on a non-zero exit.
pub fn output_bytes(cmd: &mut Command) -> Result<Vec<u8>> {
    let out = cmd
        .output()
        .with_context(|| format!("failed to start `{}`", describe(cmd)))?;
    if !out.status.success() {
        bail!("`{}` failed ({})", describe(cmd), out.status);
    }
    Ok(out.stdout)
}

fn describe(cmd: &Command) -> String {
    let mut parts = vec![cmd.get_program().to_string_lossy().into_owned()];
    parts.extend(cmd.get_args().map(|a| a.to_string_lossy().into_owned()));
    parts.join(" ")
}

/// Chinese, Japanese and Korean characters, including full-width punctuation.
pub fn is_cjk(c: char) -> bool {
    matches!(
        c as u32,
        0x3000..=0x303F // CJK symbols and punctuation
            | 0x3040..=0x30FF // kana
            | 0x3400..=0x4DBF // extension A
            | 0x4E00..=0x9FFF // unified ideographs
            | 0xAC00..=0xD7AF // hangul
            | 0xF900..=0xFAFF // compatibility ideographs
            | 0xFF00..=0xFFEF // full-width forms
            | 0x20000..=0x3FFFF // extensions B and later
    )
}

/// Today's date in the committer's local time zone, as `YYYY-MM-DD`.
///
/// `git var GIT_COMMITTER_IDENT` ends with `<unix seconds> <+hhmm>`, which gives
/// the local date without a time zone library. Only `release` needs this, and
/// it runs where git has an identity to commit with anyway.
pub fn today(root: &Path) -> Result<String> {
    let ident = output(command("git", root).args(["var", "GIT_COMMITTER_IDENT"]))?;
    let mut fields = ident.split_whitespace().rev();
    let (Some(offset), Some(seconds)) = (fields.next(), fields.next()) else {
        bail!("unexpected `git var GIT_COMMITTER_IDENT` output");
    };
    let seconds: i64 = seconds.parse().context("bad timestamp from git")?;
    let offset = parse_utc_offset(offset).context("bad time zone offset from git")?;
    let (y, m, d) = civil_from_days((seconds + offset).div_euclid(86_400));
    Ok(format!("{y:04}-{m:02}-{d:02}"))
}

/// The current time in UTC as RFC 3339, e.g. `2026-11-15T01:02:03Z`. Needs no
/// git identity, which CI runners do not have.
pub fn now_rfc3339() -> Result<String> {
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .context("the system clock is before 1970")?
        .as_secs();
    Ok(rfc3339_utc(i64::try_from(seconds)?))
}

fn rfc3339_utc(seconds: i64) -> String {
    let (y, m, d) = civil_from_days(seconds.div_euclid(86_400));
    let of_day = seconds.rem_euclid(86_400);
    let (h, min, s) = (of_day / 3600, of_day % 3600 / 60, of_day % 60);
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{min:02}:{s:02}Z")
}

/// Parses `+hhmm` / `-hhmm` into seconds.
fn parse_utc_offset(s: &str) -> Option<i64> {
    let (sign, digits) = match s.split_at_checked(1)? {
        ("+", d) => (1, d),
        ("-", d) => (-1, d),
        _ => return None,
    };
    if digits.len() != 4 || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let hours: i64 = digits[..2].parse().ok()?;
    let minutes: i64 = digits[2..].parse().ok()?;
    Some(sign * (hours * 3600 + minutes * 60))
}

/// Days since 1970-01-01 to a proleptic Gregorian date (Howard Hinnant's
/// `civil_from_days`).
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    (y, m as u32, d as u32)
}

/// A plain `X.Y.Z` version. Pre-release and build suffixes are rejected on
/// purpose: releases stay numeric until there is a reason for pre-releases.
pub fn parse_version(s: &str) -> Option<(u64, u64, u64)> {
    let mut parts = s.split('.');
    let mut next = || -> Option<u64> {
        let part = parts.next()?;
        let canonical = part == "0" || !part.starts_with('0');
        if part.is_empty() || !canonical || !part.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        part.parse().ok()
    };
    let version = (next()?, next()?, next()?);
    parts.next().is_none().then_some(version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn days_convert_to_calendar_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(20_407), (2025, 11, 15));
        assert_eq!(civil_from_days(-1), (1969, 12, 31));
        assert_eq!(civil_from_days(11_016), (2000, 2, 29));
    }

    #[test]
    fn timestamps_format_as_rfc3339_utc() {
        assert_eq!(rfc3339_utc(0), "1970-01-01T00:00:00Z");
        assert_eq!(rfc3339_utc(1_763_168_523), "2025-11-15T01:02:03Z");
    }

    #[test]
    fn utc_offsets_parse_both_signs() {
        assert_eq!(parse_utc_offset("+0900"), Some(32_400));
        assert_eq!(parse_utc_offset("-0130"), Some(-5_400));
        assert_eq!(parse_utc_offset("0900"), None);
        assert_eq!(parse_utc_offset("+9"), None);
    }

    #[test]
    fn versions_must_be_three_canonical_numbers() {
        assert_eq!(parse_version("0.1.0"), Some((0, 1, 0)));
        assert_eq!(parse_version("10.20.30"), Some((10, 20, 30)));
        assert_eq!(parse_version("0.1"), None);
        assert_eq!(parse_version("0.1.0.4"), None);
        assert_eq!(parse_version("0.1.0-beta.1"), None);
        assert_eq!(parse_version("01.1.0"), None);
        assert_eq!(parse_version("v0.1.0"), None);
    }

    #[test]
    fn cjk_detection_covers_han_and_full_width_punctuation() {
        assert!("\u{4E2D}\u{6587}".chars().all(is_cjk));
        assert!(is_cjk('\u{FF0C}'));
        assert!(is_cjk('\u{30AB}'));
        assert!(!"plain ascii - and é".chars().any(is_cjk));
    }
}
