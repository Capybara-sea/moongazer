// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Artifact, SlotKey } from "@/domain/good"
import { bySlot, setCounts } from "./artifacts"

const piece = (slotKey: SlotKey, setKey = "FakeSet"): Artifact => ({
  setKey,
  slotKey,
  level: 20,
  rarity: 5,
  mainStatKey: "hp",
  location: "FakeHero",
  lock: false,
  substats: [],
  unactivatedSubstats: [],
  astralMark: false,
  elixirCrafted: false,
})

describe("bySlot", () => {
  it("puts the pieces in the game's slot order", () => {
    const pieces = [piece("circlet"), piece("flower"), piece("goblet"), piece("plume")]
    expect(bySlot(pieces).map(a => a.slotKey)).toEqual(["flower", "plume", "goblet", "circlet"])
  })
})

describe("setCounts", () => {
  it("lists sets with two or more pieces, most pieces first", () => {
    const pieces = [
      piece("flower", "FakeSetA"),
      piece("plume", "FakeSetB"),
      piece("sands", "FakeSetB"),
      piece("goblet", "FakeSetB"),
      piece("circlet", "FakeSetA"),
    ]
    expect(setCounts(pieces)).toEqual([
      { setKey: "FakeSetB", count: 3 },
      { setKey: "FakeSetA", count: 2 },
    ])
  })

  it("leaves out single pieces and keeps ties in the order the pieces come", () => {
    const pieces = [
      piece("flower", "FakeSetA"),
      piece("plume", "FakeSetA"),
      piece("sands", "FakeSetC"),
      piece("goblet", "FakeSetB"),
      piece("circlet", "FakeSetB"),
    ]
    expect(setCounts(pieces).map(set => set.setKey)).toEqual(["FakeSetA", "FakeSetB"])
  })
})
