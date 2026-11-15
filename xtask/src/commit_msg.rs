// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The `commit-msg` hook: English text and a short subject line.

use std::fs;

use anyhow::{Context, Result, bail};

use crate::util::is_cjk;

const MAX_SUBJECT: usize = 72;
const SCISSORS: &str = "# ------------------------ >8 ------------------------";
/// Subjects git writes itself; they may run past the limit.
const GENERATED_PREFIXES: &[&str] = &["fixup! ", "squash! ", "amend! ", "Revert \""];

pub fn run(path: &str) -> Result<()> {
    let text = fs::read_to_string(path).with_context(|| format!("reading {path}"))?;
    let problems = check(&text);
    if problems.is_empty() {
        return Ok(());
    }
    for problem in &problems {
        eprintln!("commit message: {problem}");
    }
    bail!(
        "commit message rejected: write it in English with a subject of at most \
         {MAX_SUBJECT} characters"
    );
}

/// The subject skips `#` lines like git's cleanup does. The CJK check covers
/// every line above the scissors, `#` lines included, because `git commit -m`
/// keeps them in the message.
fn check(text: &str) -> Vec<String> {
    let lines: Vec<(usize, &str)> = text
        .lines()
        .take_while(|line| *line != SCISSORS)
        .enumerate()
        .collect();
    let mut problems = Vec::new();
    let subject = lines
        .iter()
        .find(|(_, line)| !line.starts_with('#') && !line.trim().is_empty());
    match subject {
        None => problems.push("the message is empty".to_owned()),
        Some((_, subject)) => {
            let len = subject.chars().count();
            let generated = GENERATED_PREFIXES.iter().any(|p| subject.starts_with(p));
            if len > MAX_SUBJECT && !generated {
                problems.push(format!(
                    "subject is {len} characters; keep it to {MAX_SUBJECT}"
                ));
            }
        }
    }
    for (idx, line) in &lines {
        if line.chars().any(is_cjk) {
            problems.push(format!(
                "line {} has CJK text; write commit messages in English",
                idx + 1
            ));
        }
    }
    problems
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_normal_message_passes() {
        let msg = "Add repository guard\n\nWhy it exists.\n\n# Please enter the message.\n";
        assert_eq!(check(msg), Vec::<String>::new());
    }

    #[test]
    fn long_subjects_and_cjk_are_rejected() {
        let long = format!("{}\n", "x".repeat(73));
        assert_eq!(check(&long).len(), 1);
        let cjk = "Add guard\n\n\u{4E2D}\u{6587}\n";
        assert!(check(cjk)[0].contains("line 3"));
    }

    #[test]
    fn the_verbose_diff_is_ignored_but_comment_lines_are_checked() {
        let msg = format!("Fix\n# note\n{SCISSORS}\n+\u{4E2D}\u{6587}\n");
        assert_eq!(check(&msg), Vec::<String>::new());
        // `git commit -m` keeps `#` lines, so CJK there is still rejected.
        assert!(check("Fix\n\n# \u{4E2D}\n")[0].contains("line 3"));
        assert_eq!(
            check("# only a comment\n\n"),
            vec!["the message is empty".to_owned()]
        );
    }

    #[test]
    fn subjects_written_by_git_may_be_long() {
        let original = "x".repeat(70);
        assert_eq!(check(&format!("fixup! {original}\n")), Vec::<String>::new());
        assert_eq!(
            check(&format!("Revert \"{original}\"\n")),
            Vec::<String>::new()
        );
    }
}
