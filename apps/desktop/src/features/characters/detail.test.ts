// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import type { Character } from "@/domain/good"
import type { CharacterStats } from "@/domain/stats"
import { ascended, comparedAccount, detailOrder, neighbors, statRows } from "./detail"

function character(key: string, level: number): Character {
  return {
    key,
    level,
    ascension: 0,
    constellation: 0,
    talent: { auto: 1, skill: 1, burst: 1 },
  }
}

const roster = [character("FakeHeroA", 10), character("FakeHeroB", 30), character("FakeHeroC", 20)]
const keys = (list: Character[]) => list.map(c => c.key)

describe("detailOrder", () => {
  const options: Parameters<typeof detailOrder>[1] = {
    element: null,
    query: "FakeHeroB",
    sort: "level",
  }

  it("follows the list's filter and sort while they keep the character", () => {
    expect(keys(detailOrder(roster, options, "FakeHeroB"))).toEqual(["FakeHeroB"])
  })

  it("falls back to every character in the same sort when the filter hides it", () => {
    expect(keys(detailOrder(roster, options, "FakeHeroA"))).toEqual([
      "FakeHeroB",
      "FakeHeroC",
      "FakeHeroA",
    ])
  })
})

describe("neighbors", () => {
  const list = ["FakeHeroA", "FakeHeroB", "FakeHeroC"]

  it("gives the position from one and the keys on either side", () => {
    expect(neighbors(list, "FakeHeroB")).toEqual({
      at: 2,
      total: 3,
      previous: "FakeHeroA",
      next: "FakeHeroC",
    })
  })

  it("wraps around at both ends", () => {
    expect(neighbors(list, "FakeHeroA")?.previous).toBe("FakeHeroC")
    expect(neighbors(list, "FakeHeroC")?.next).toBe("FakeHeroA")
  })

  it("points a lone character at itself", () => {
    expect(neighbors(["FakeHeroA"], "FakeHeroA")).toEqual({
      at: 1,
      total: 1,
      previous: "FakeHeroA",
      next: "FakeHeroA",
    })
  })

  it("knows no place for a key missing from the list", () => {
    expect(neighbors(list, "FakeHeroZ")).toBeUndefined()
  })
})

describe("ascended", () => {
  it("counts a character below the cap its phases give", () => {
    expect(ascended(80, 6)).toBe(true)
    expect(ascended(75, 5)).toBe(true)
    expect(ascended(20, 1)).toBe(true)
  })

  it("does not count one at a cap, waiting to ascend or fully ascended, or one never ascended", () => {
    expect(ascended(90, 6)).toBe(false)
    expect(ascended(80, 5)).toBe(false)
    expect(ascended(20, 0)).toBe(false)
    expect(ascended(15, 0)).toBe(false)
  })
})

describe("comparedAccount", () => {
  const account: Account = {
    characters: [],
    weapons: [],
    artifacts: [],
    materials: new Map(),
    characterInfo: new Map(),
  }

  it("compares with an older account that lists characters", () => {
    const withCharacters = { ...account, characters: [character("FakeHeroA", 10)] }
    expect(comparedAccount(withCharacters)).toBe(withCharacters)
  })

  it("has nothing to compare with when the older account lists no characters", () => {
    expect(comparedAccount(account)).toBeNull()
  })

  it("passes on waiting and having no older account", () => {
    expect(comparedAccount(undefined)).toBeUndefined()
    expect(comparedAccount(null)).toBeNull()
  })
})

describe("statRows", () => {
  const split = (base: number, total: number) => ({ base, total })
  const stats: CharacterStats = {
    hp: split(12906.6, 20962.4),
    atk: split(1000, 2000),
    def: split(789, 789),
    eleMas: 0,
    critRate_: 5,
    critDMG_: 50,
    enerRech_: 100,
    heal_: 0,
    pyro_dmg_: 0,
    hydro_dmg_: 0,
    anemo_dmg_: 0,
    electro_dmg_: 0,
    dendro_dmg_: 0,
    cryo_dmg_: 0,
    geo_dmg_: 0,
    physical_dmg_: 0,
  }
  const keys = (rows: ReturnType<typeof statRows>) => rows.map(row => row.key)

  it("gives HP, ATK and DEF a base and a bonus that add up to the rounded total", () => {
    expect(statRows(stats, "electro")[0]).toEqual({
      key: "hp",
      total: "20,962",
      base: "12,907",
      bonus: "8,055",
    })
  })

  it("always lists mastery, CRIT, recharge and the character's own DMG bonus", () => {
    expect(keys(statRows(stats, "electro"))).toEqual([
      "hp",
      "atk",
      "def",
      "eleMas",
      "critRate_",
      "critDMG_",
      "enerRech_",
      "electro_dmg_",
    ])
    expect(keys(statRows(stats, undefined))).toHaveLength(7)
  })

  it("adds other DMG bonuses and healing only above zero, healing last", () => {
    const rows = statRows({ ...stats, pyro_dmg_: 15, physical_dmg_: 25.8, heal_: 10 }, "electro")
    expect(keys(rows).slice(7)).toEqual(["pyro_dmg_", "electro_dmg_", "physical_dmg_", "heal_"])
    expect(rows.at(-2)).toEqual({ key: "physical_dmg_", total: "25.8%" })
  })
})
