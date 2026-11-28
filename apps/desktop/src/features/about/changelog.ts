// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import changelogEn from "@repo/CHANGELOG.en.md?raw"
import changelogZh from "@repo/CHANGELOG.md?raw"
import { lang } from "@/i18n"

export type ChangelogSection = { title: string; items: string[] }
export type ChangelogVersion = { version: string; date: string; sections: ChangelogSection[] }

const VERSION = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*$/

/**
 * The released versions of a Keep a Changelog file, newest first as written.
 * [Unreleased], the text before it and the link lines at the end are left out;
 * an item's wrapped lines are joined to it.
 */
export function parseChangelog(markdown: string): ChangelogVersion[] {
  const versions: ChangelogVersion[] = []
  let version: ChangelogVersion | null = null
  let items: string[] | null = null
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (line.startsWith("## ")) {
      const [, number, date] = VERSION.exec(line) ?? []
      version = number && date ? { version: number, date, sections: [] } : null
      if (version) versions.push(version)
      items = null
      continue
    }
    if (!version) continue
    if (line.startsWith("### ")) {
      items = []
      version.sections.push({ title: line.slice(4).trim(), items })
    } else if (line.startsWith("- ") && items) {
      items.push(line.slice(2).trim())
    } else if (/^\s+\S/.test(line) && items?.length) {
      items[items.length - 1] += ` ${line.trim()}`
    }
  }
  return versions
}

/** The app's released versions, from the changelog in the UI's language. */
export const APP_CHANGELOG = parseChangelog(lang === "en" ? changelogEn : changelogZh)

/** Compares two x.y.z versions: negative when a is older. */
export function compareVersions(a: string, b: string) {
  const x = a.split(".").map(Number)
  const y = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * The versions to show after an update to `current`: each one newer than
 * `seen` up to `current`, newest first. Without a version seen before, only
 * `current`, and nothing on a first run.
 */
export function versionsSince(
  versions: readonly ChangelogVersion[],
  current: string,
  seen: string | null,
  firstRun: boolean,
) {
  if (seen === null) {
    return firstRun ? [] : versions.filter(v => v.version === current)
  }
  return versions.filter(
    v => compareVersions(v.version, seen) > 0 && compareVersions(v.version, current) <= 0,
  )
}
