// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Artifact } from "@/domain/good"
import { text } from "@/i18n"
import {
  type ArtifactRow,
  artifactCounts,
  artifactRows,
  setOptions,
  visibleArtifacts,
} from "./order"

const artifact = (fields: Partial<Artifact> = {}): Artifact => ({
  setKey: "FakeSet",
  slotKey: "flower",
  level: 0,
  rarity: 5,
  mainStatKey: "hp",
  location: "",
  lock: false,
  substats: [],
  unactivatedSubstats: [],
  astralMark: false,
  elixirCrafted: false,
  ...fields,
})

let nextId = 0
function row(fields: Partial<Artifact> = {}, setName = "Fake"): ArtifactRow {
  return { id: nextId++, artifact: artifact(fields), setName }
}

const ids = (rows: ArtifactRow[]) => rows.map(r => r.id)
const all = { slot: null, set: null, onlyFree: false }

describe("artifactRows", () => {
  it("names unknown sets as not in the data", () => {
    const [only] = artifactRows([artifact({ setKey: "FakeSet" })])
    expect(only?.setName).toBe(text.names.unknown("FakeSet"))
  })

  it("names the wielder, any Traveler as the Traveler, and no one when unequipped", () => {
    const rows = artifactRows([
      artifact({ location: "FakeHero" }),
      artifact({ location: "Traveler" }),
      artifact(),
    ])
    expect(rows.map(r => r.wielder)).toEqual([
      text.names.unknown("FakeHero"),
      text.names.traveler,
      undefined,
    ])
  })

  it("orders by level, then rarity, then set name, then slot, then the export's order", () => {
    const rows = artifactRows([
      artifact({ level: 16 }),
      artifact({ level: 20, rarity: 4 }),
      artifact({ level: 20, setKey: "FakeB" }),
      artifact({ level: 20, setKey: "FakeA", slotKey: "circlet" }),
      artifact({ level: 20, setKey: "FakeA", slotKey: "plume" }),
      artifact({ level: 20, setKey: "FakeA", slotKey: "plume" }),
    ])
    expect(ids(rows)).toEqual([4, 5, 3, 2, 1, 0])
  })
})

describe("artifactCounts", () => {
  it("counts all, those at +20 and equipped ones", () => {
    const rows = [
      row({ level: 20, location: "FakeHero" }),
      row({ level: 20 }),
      row({ level: 16, location: "FakeOther" }),
      row(),
    ]
    expect(artifactCounts(rows)).toEqual({ total: 4, maxed: 2, equipped: 2 })
  })
})

describe("setOptions", () => {
  it("lists each set once with its count, by name in Chinese order", () => {
    const { flower, plume, sands, goblet, circlet } = text.game.slots
    // These names sort differently by pinyin than by code point.
    const rows = [
      row({ setKey: "FakeA" }, flower),
      row({ setKey: "FakeB" }, plume),
      row({ setKey: "FakeA", slotKey: "plume", location: "FakeHero" }, flower),
      row({ setKey: "FakeC" }, sands),
      row({ setKey: "FakeD" }, goblet),
      row({ setKey: "FakeE" }, circlet),
      row({ setKey: "FakeA", level: 20 }, flower),
    ]
    expect(setOptions(rows)).toEqual([
      { value: "FakeD", label: goblet, count: 1 },
      { value: "FakeE", label: circlet, count: 1 },
      { value: "FakeA", label: flower, count: 3 },
      { value: "FakeC", label: sands, count: 1 },
      { value: "FakeB", label: plume, count: 1 },
    ])
  })
})

describe("visibleArtifacts", () => {
  it("keeps only the chosen slot", () => {
    const rows = [row({ slotKey: "sands" }), row({ slotKey: "goblet" })]
    expect(visibleArtifacts(rows, { ...all, slot: "goblet" })).toEqual([rows[1]])
  })

  it("keeps only the chosen set", () => {
    const rows = [row({ setKey: "FakeA" }), row({ setKey: "FakeB" })]
    expect(visibleArtifacts(rows, { ...all, set: "FakeA" })).toEqual([rows[0]])
  })

  it("keeps only unequipped artifacts when asked", () => {
    const rows = [row({ location: "FakeHero" }), row()]
    expect(visibleArtifacts(rows, { ...all, onlyFree: true })).toEqual([rows[1]])
  })

  it("applies all filters together and keeps the rows' order", () => {
    const rows = [
      row({ slotKey: "plume", setKey: "FakeA" }),
      row({ slotKey: "flower", setKey: "FakeA" }),
      row({ slotKey: "plume", setKey: "FakeA", location: "FakeHero" }),
      row({ slotKey: "plume", setKey: "FakeB" }),
      row({ slotKey: "plume", setKey: "FakeA" }),
    ]
    const options = { slot: "plume", set: "FakeA", onlyFree: true } as const
    expect(visibleArtifacts(rows, options)).toEqual([rows[0], rows[4]])
  })
})
