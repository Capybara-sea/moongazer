// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import builds from "@/generated/builds.json"
import names from "@/generated/names.json"
import {
  artifactIcon,
  formatStat,
  levelCap,
  mainStatValue,
  talentBoosts,
  talentLevels,
  wielderKey,
} from "./builds"

// The tables are regenerated with every game version, so cases are picked from them.
const [boostedKey, boosts] = Object.entries(builds.talentBoosts)[0] ?? ["", []]

describe("build data", () => {
  it("caps levels by ascension phase", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(levelCap)).toEqual([20, 40, 50, 60, 70, 80, 90])
    expect(levelCap(9)).toBe(90)
  })

  it("adds three levels to the talents constellations 3 and 5 raise", () => {
    const [third, fifth] = talentBoosts(boostedKey)
    expect([third, fifth]).toEqual(boosts)
    const character = (constellation: number) => ({
      key: boostedKey,
      level: 90,
      ascension: 6,
      constellation,
      talent: { auto: 1, skill: 1, burst: 1 },
    })
    const levels = (constellation: number) => talentLevels(character(constellation))
    expect(Object.values(levels(2)).every(level => level.total === 1)).toBe(true)
    if (third) expect(levels(3)[third]).toEqual({ base: 1, total: 4, boosted: true })
    if (fifth) expect(levels(5)[fifth].total).toBe(4)
    expect(talentBoosts("NoSuchFakeKey")).toEqual([])
  })

  it("looks up main stats by rarity, key and level", () => {
    expect(mainStatValue(5, "atk_", 0)).toBeGreaterThan(0)
    expect(mainStatValue(5, "atk_", 20)).toBeGreaterThan(mainStatValue(5, "atk_", 0) ?? 0)
    expect(mainStatValue(5, "noSuchStat", 0)).toBeUndefined()
  })

  it("shows percentages with one decimal and flat stats as whole numbers", () => {
    expect(formatStat("critRate_", 3.9)).toBe("3.9%")
    expect(formatStat("hp", 4780)).toBe("4,780")
    expect(formatStat("eleMas", 186.5)).toBe("187")
  })

  it("names a piece's icon after its set's icon and its slot", () => {
    const [setKey, set] = Object.entries(names.artifactSets)[0] ?? ["", { icon: "" }]
    const id = set.icon.match(/^UI_RelicIcon_(\d+)_\d$/)?.[1]
    expect(artifactIcon(setKey, "flower")).toBe(`UI_RelicIcon_${id}_4`)
    expect(artifactIcon(setKey, "goblet")).toBe(`UI_RelicIcon_${id}_1`)
    expect(artifactIcon("NoSuchFakeSet", "flower")).toBeUndefined()
  })

  it("finds the gear of any Traveler under one name", () => {
    expect(wielderKey("TravelerAnemo")).toBe("Traveler")
    expect(wielderKey("FakeHero")).toBe("FakeHero")
  })
})
