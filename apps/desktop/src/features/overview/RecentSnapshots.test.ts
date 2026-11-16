// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Snapshot, Summary } from "@/lib/backend"
import { formatDelta } from "@/lib/format"
import { text } from "@/text/zh"
import { describeChange } from "./RecentSnapshots"

const snapshot = (id: number, summary: Partial<Summary>): Snapshot => ({
  id,
  takenAt: id,
  importedAt: id,
  format: "leyline",
  source: "Teyvat.me",
  summary: {
    characters: 1,
    weapons: 1,
    artifacts: 1,
    materials: 1,
    mora: 0,
    primogems: 0,
    ...summary,
  },
  hasRaw: true,
})

describe("describeChange", () => {
  const { change } = text.overview

  it("lists the totals that moved since the snapshot before", () => {
    const older = [snapshot(1, { mora: 100, weapons: 3 })]
    expect(describeChange(snapshot(2, { mora: 160, weapons: 4 }), older)).toBe(
      `${change.mora} ${formatDelta(60)} · ${change.weapons} ${formatDelta(1)}`,
    )
    expect(describeChange(snapshot(2, { mora: 100, weapons: 3 }), older)).toBeNull()
    expect(describeChange(snapshot(1, {}), [])).toBeNull()
  })

  it("compares currencies past a snapshot that did not know them", () => {
    const good = snapshot(2, { mora: null, primogems: null })
    const older = [good, snapshot(1, { mora: 100, primogems: 5 })]
    expect(describeChange(snapshot(3, { mora: 150, primogems: 5 }), older)).toBe(
      `${change.mora} ${formatDelta(50)}`,
    )
    expect(describeChange(good, older.slice(1))).toBeNull()
  })
})
