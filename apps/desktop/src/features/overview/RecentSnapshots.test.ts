// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Snapshot, Summary } from "@/lib/backend"
import { signedDelta } from "@/lib/format"
import { text } from "@/text/zh"
import { describeChange } from "./RecentSnapshots"

const snapshot = (id: number, summary: Partial<Summary>): Snapshot => ({
  id,
  takenAt: id,
  importedAt: id,
  source: "Teyvat.me",
  uid: null,
  summary: {
    characters: 1,
    weapons: 1,
    artifacts: 1,
    materials: 1,
    mora: 0,
    primogems: 0,
    artifacts4: 0,
    artifacts3: 0,
    essence: 0,
    ...summary,
  },
  hasRaw: true,
  review: false,
  session: null,
  live: false,
})

describe("describeChange", () => {
  const { change } = text.overview

  it("lists the totals that moved since the snapshot before", () => {
    const older = [snapshot(1, { mora: 100, weapons: 3 })]
    expect(describeChange(snapshot(2, { mora: 160, weapons: 2 }), older)).toEqual([
      { label: change.mora, change: signedDelta(60) },
      { label: change.weapons, change: signedDelta(-1) },
    ])
    expect(describeChange(snapshot(2, { mora: 100, weapons: 3 }), older)).toBeNull()
    expect(describeChange(snapshot(1, {}), [])).toBeNull()
  })

  it("compares currencies past a snapshot that did not know them", () => {
    const bare = snapshot(2, { mora: null, primogems: null })
    const older = [bare, snapshot(1, { mora: 100, primogems: 5 })]
    expect(describeChange(snapshot(3, { mora: 150, primogems: 5 }), older)).toEqual([
      { label: change.mora, change: signedDelta(50) },
    ])
    expect(describeChange(bare, older.slice(1))).toBeNull()
  })
})
