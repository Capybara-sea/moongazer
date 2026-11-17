// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Snapshot, Summary } from "@/lib/backend"
import { text } from "@/text/zh"
import { countTiles } from "./tileValues"

const snapshot = (id: number, summary: Partial<Summary>): Snapshot => ({
  id,
  takenAt: id,
  importedAt: id,
  format: "leyline",
  source: "Teyvat.me",
  summary: {
    characters: 10,
    weapons: 20,
    artifacts: 30,
    materials: 40,
    mora: 1000,
    primogems: 100,
    artifacts4: 5,
    artifacts3: 6,
    essence: 0,
    ...summary,
  },
  hasRaw: true,
})

const { tiles } = text
const byLabel = (snapshot: Snapshot, older: Snapshot[], label: string) =>
  countTiles(snapshot, older).find(tile => tile.label === label)

describe("countTiles", () => {
  it("shows six totals in the design's order", () => {
    expect(countTiles(snapshot(1, {}), []).map(tile => tile.label)).toEqual([
      tiles.mora,
      tiles.primogems,
      tiles.characters,
      tiles.weapons,
      tiles.artifacts,
      tiles.lowArtifacts,
    ])
  })

  it("marks every total of the first snapshot as the first", () => {
    for (const tile of countTiles(snapshot(1, {}), [])) {
      expect(tile.change).toEqual({ text: tiles.first, up: false })
    }
  })

  it("compares with the snapshot before and marks only gains as up", () => {
    const older = [snapshot(1, {})]
    const now = snapshot(2, { mora: 127_000, characters: 11, weapons: 19, artifacts: 30 })
    expect(byLabel(now, older, tiles.mora)).toEqual({
      label: tiles.mora,
      value: text.number.tenThousand("12.7"),
      change: { text: tiles.sincePrevious(`+${text.number.tenThousand("12.6")}`), up: true },
    })
    expect(byLabel(now, older, tiles.characters)?.change).toEqual({
      text: tiles.sincePrevious("+1"),
      up: true,
    })
    expect(byLabel(now, older, tiles.weapons)?.change).toEqual({
      text: tiles.sincePrevious("-1"),
      up: false,
    })
    expect(byLabel(now, older, tiles.artifacts)?.change).toEqual({
      text: tiles.sincePrevious("0"),
      up: false,
    })
  })

  it("compares currencies past a snapshot that did not know them", () => {
    const older = [snapshot(2, { mora: null, primogems: null }), snapshot(1, { primogems: 100 })]
    expect(byLabel(snapshot(3, { primogems: 260 }), older, tiles.primogems)?.change).toEqual({
      text: tiles.sincePrevious("+160"),
      up: true,
    })
  })

  it("shows a dash and no change for a currency no snapshot knew", () => {
    const tile = byLabel(snapshot(2, { mora: null }), [snapshot(1, { mora: null })], tiles.mora)
    expect(tile).toEqual({ label: tiles.mora, value: text.number.missing, change: null })
  })

  it("shows the last known value of a currency the file lacks, saying where it is from", () => {
    const takenAt = new Date(2026, 10, 15, 21, 4).getTime()
    const older = [{ ...snapshot(1, { mora: 127_000 }), takenAt }]
    const tile = byLabel(snapshot(2, { mora: null }), older, tiles.mora)
    expect(tile).toEqual({
      label: tiles.mora,
      value: text.number.tenThousand("12.7"),
      change: { text: tiles.borrowed("11-15 21:04"), up: false },
    })
  })

  it("has no change when no older snapshot knew the currency", () => {
    const older = [snapshot(1, { mora: null })]
    expect(byLabel(snapshot(2, {}), older, tiles.mora)?.change).toBeNull()
  })

  it("shows the Leyline snapshot standing in for a GOOD file, saying where it is from", () => {
    const takenAt = new Date(2026, 10, 15, 21, 4).getTime()
    const standIn = { ...snapshot(1, { characters: 99, mora: 127_000 }), takenAt }
    const shown = countTiles(snapshot(2, { characters: 3, mora: null }), [], standIn)
    const borrowed = { text: tiles.borrowed("11-15 21:04"), up: false }
    expect(shown.find(t => t.label === tiles.characters)).toMatchObject({
      value: "99",
      change: borrowed,
    })
    expect(shown.find(t => t.label === tiles.mora)?.change).toEqual(borrowed)
  })

  it("shows 4-star and 3-star artifacts as a pair with both changes", () => {
    const older = [snapshot(1, { artifacts4: 52, artifacts3: 76 })]
    const tile = byLabel(snapshot(2, { artifacts4: 58, artifacts3: 75 }), older, tiles.lowArtifacts)
    expect(tile).toEqual({
      label: tiles.lowArtifacts,
      page: "artifacts",
      value: tiles.pair("58", "75"),
      change: { text: tiles.sincePrevious(tiles.pair("+6", "-1")), up: true },
    })
  })

  it("shows a dash for artifact counts from before they were counted", () => {
    const now = snapshot(2, { artifacts4: null, artifacts3: null })
    const tile = byLabel(now, [snapshot(1, {})], tiles.lowArtifacts)
    expect(tile).toEqual({
      label: tiles.lowArtifacts,
      value: text.number.missing,
      change: null,
      page: "artifacts",
    })
  })

  it("explains an export without any 4-star or 3-star artifacts", () => {
    const now = snapshot(2, { artifacts4: 0, artifacts3: 0 })
    expect(byLabel(now, [snapshot(1, {})], tiles.lowArtifacts)).toEqual({
      label: tiles.lowArtifacts,
      page: "artifacts",
      value: tiles.notIncluded,
      hint: tiles.notIncludedHint,
      change: null,
    })
  })

  it("does not compare artifact counts with a snapshot that had none or did not count them", () => {
    const now = snapshot(3, { artifacts4: 52, artifacts3: 76 })
    for (const before of [
      snapshot(2, { artifacts4: 0, artifacts3: 0 }),
      snapshot(2, { artifacts4: null, artifacts3: null }),
    ]) {
      expect(byLabel(now, [before], tiles.lowArtifacts)?.change).toBeNull()
    }
  })
})
