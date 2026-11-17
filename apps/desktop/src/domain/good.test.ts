// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { artifacts, characterInfo, characters, materials, weapons } from "./good"

describe("GOOD lists", () => {
  it("reads characters, reading numbers Leyline leaves out as 0", () => {
    const [hero] = characters([
      { key: "FakeHero", level: 80, constellation: 2, talent: { auto: 9, burst: 8 } },
      { level: 90 },
      "not a character",
    ])
    expect(hero?.key).toBe("FakeHero")
    expect(hero?.ascension).toBe(0)
    expect(hero?.talent).toEqual({ auto: 9, skill: 0, burst: 8 })
    expect(characters({ characters: [] })).toEqual([])
  })

  it("reads weapons with an empty location when unequipped", () => {
    const [blade, held] = weapons([
      { key: "FakeBlade", level: 90, refinement: 5 },
      { key: "FakeBow", location: "FakeHero", lock: true },
    ])
    expect([blade?.location, blade?.lock, blade?.refinement]).toEqual(["", false, 5])
    expect([held?.location, held?.lock]).toEqual(["FakeHero", true])
  })

  it("keeps artifacts with a known slot and drops blank substats", () => {
    const list = artifacts([
      {
        setKey: "FakeSet",
        slotKey: "sands",
        mainStatKey: "atk_",
        rarity: 5,
        level: 20,
        substats: [
          { key: "critRate_", value: 3.9 },
          { key: "", value: 0 },
        ],
        unactivatedSubstats: [{ key: "hp", value: 299 }],
        elixerCrafted: true,
      },
      { setKey: "FakeSet", slotKey: "ring", mainStatKey: "hp" },
    ])
    expect(list).toHaveLength(1)
    expect(list[0]?.substats).toEqual([{ key: "critRate_", value: 3.9 }])
    expect(list[0]?.unactivatedSubstats).toHaveLength(1)
    expect(list[0]?.elixirCrafted).toBe(true)
    expect(list[0]?.totalRolls).toBeUndefined()
  })

  it("reads material counts by key and skips entries that are not numbers", () => {
    const counts = materials({ FakeOre: 12, FakeCoin: 0, FakeText: "3", FakeNull: null })
    expect([...counts]).toEqual([
      ["FakeOre", 12],
      ["FakeCoin", 0],
    ])
    expect(materials([{ FakeOre: 1 }]).size).toBe(0)
    expect(materials(undefined).size).toBe(0)
  })

  it("reads friendship and join times in milliseconds by character", () => {
    const info = characterInfo({ FakeHero: { friendship: 10, obtainedAt: 1_000 }, Bad: 3 })
    expect(info.get("FakeHero")).toEqual({ friendship: 10, obtainedAt: 1_000_000 })
    expect(info.has("Bad")).toBe(false)
  })
})
