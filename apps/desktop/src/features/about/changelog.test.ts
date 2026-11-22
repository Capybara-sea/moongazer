// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { APP_CHANGELOG, compareVersions, parseChangelog, versionsSince } from "./changelog"

const SAMPLE = [
  "# Changelog",
  "",
  "Some words about the file, with a [link](https://example.com).",
  "",
  "## [Unreleased]",
  "",
  "### Added",
  "",
  "- Not out yet.",
  "",
  "## [0.3.0] - 2026-11-22",
  "",
  "### Added",
  "",
  "- A planner page, with goals and what they",
  "  still need.",
  "",
  "### Fixed",
  "",
  "- One fix.",
  "- Another fix.",
  "",
  "## [0.2.0] - 2026-11-21",
  "",
  "### Changed",
  "",
  "- A change.",
  "",
  "[unreleased]: https://example.com/compare/v0.3.0...HEAD",
  "[0.3.0]: https://example.com/compare/v0.2.0...v0.3.0",
].join("\r\n")

const versions = parseChangelog(SAMPLE)

describe("parseChangelog", () => {
  it("reads the released versions with their sections, leaving out Unreleased and the links", () => {
    expect(versions).toEqual([
      {
        version: "0.3.0",
        date: "2026-11-22",
        sections: [
          { title: "Added", items: ["A planner page, with goals and what they still need."] },
          { title: "Fixed", items: ["One fix.", "Another fix."] },
        ],
      },
      {
        version: "0.2.0",
        date: "2026-11-21",
        sections: [{ title: "Changed", items: ["A change."] }],
      },
    ])
  })

  it("keeps reading a section past a reference link inside it, as the release notes do", () => {
    const text = [
      "## [0.4.0] - 2026-12-01",
      "### Fixed",
      "- Crash ([#3]).",
      "[#3]: https://example.com/3",
      "- Other fix.",
      "### Added",
      "- New thing.",
    ].join("\n")
    expect(parseChangelog(text)[0]?.sections).toEqual([
      { title: "Fixed", items: ["Crash ([#3]).", "Other fix."] },
      { title: "Added", items: ["New thing."] },
    ])
  })

  it("reads the app's own changelog: every version has items, newest first", () => {
    expect(APP_CHANGELOG.length).toBeGreaterThan(0)
    for (const v of APP_CHANGELOG) {
      expect(v.sections.length).toBeGreaterThan(0)
      for (const s of v.sections) expect(s.items.length).toBeGreaterThan(0)
    }
    const order = APP_CHANGELOG.map(v => v.version)
    expect([...order].sort((a, b) => compareVersions(b, a))).toEqual(order)
  })
})

describe("compareVersions", () => {
  it("compares each part as a number", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0)
    expect(compareVersions("0.2.0", "0.2.0")).toBe(0)
    expect(compareVersions("0.1.1", "0.2.0")).toBeLessThan(0)
  })
})

describe("versionsSince", () => {
  const list = parseChangelog(
    ["## [0.4.0] - 2026-12-01", "### Added", "- c", "", SAMPLE].join("\n"),
  )
  const shown = (current: string, seen: string | null, firstRun = false) =>
    versionsSince(list, current, seen, firstRun).map(v => v.version)

  it("lists every version skipped since the one seen, newest first", () => {
    expect(shown("0.4.0", "0.2.0")).toEqual(["0.4.0", "0.3.0"])
    expect(shown("0.3.0", "0.2.0")).toEqual(["0.3.0"])
  })

  it("lists nothing for the same version, a downgrade or a first run", () => {
    expect(shown("0.3.0", "0.3.0")).toEqual([])
    expect(shown("0.2.0", "0.3.0")).toEqual([])
    expect(shown("0.4.0", null, true)).toEqual([])
  })

  it("shows only the current version when the one before is unknown", () => {
    expect(shown("0.4.0", null)).toEqual(["0.4.0"])
  })
})
