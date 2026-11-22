// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import {
  type CharacterGoal,
  type Goal,
  type MaterialTotal,
  planCards,
  type WeaponGoal,
} from "@/domain/plan"
import { plannerBag } from "@/domain/planner"
import { farmToday, farmTomorrow, upgradeRows } from "@/domain/today"

function account(characters: Account["characters"]): Account {
  return {
    characters,
    weapons: [],
    artifacts: [],
    materials: new Map(),
    characterInfo: new Map(),
  }
}

describe("farming today", () => {
  const total = (key: string, need: number, have: number): MaterialTotal => ({
    key,
    need,
    have,
    goals: [],
  })
  const totals = new Map(
    [
      total("MistVeiledPrimoElixir", 9, 0),
      total("PhilosophiesOfElegance", 10, 4),
      total("TeachingsOfElegance", 9, 9),
      total("GuideToElegance", 21, 0),
      total("TeachingsOfFreedom", 9, 0),
      total("ShivadaJadeGemstone", 6, 0),
      total("?book:2", 10, 0),
    ].map(t => [t.key, t]),
  )
  const keys = (list: MaterialTotal[]) => list.map(t => t.key)

  it("lists the domain materials still short that drop that day, books first, low tiers first", () => {
    expect(keys(farmToday(totals, 1))).toEqual([
      "GuideToElegance",
      "PhilosophiesOfElegance",
      "MistVeiledPrimoElixir",
    ])
    expect(keys(farmToday(totals, 0))).toEqual(["TeachingsOfFreedom"])
    expect(keys(farmToday(totals, 6))).toEqual([
      "TeachingsOfFreedom",
      "GuideToElegance",
      "PhilosophiesOfElegance",
      "MistVeiledPrimoElixir",
    ])
  })

  it("lists what drops the next day, Sunday after Saturday and Monday after Sunday", () => {
    expect(keys(farmTomorrow(totals, 0))).toEqual(keys(farmToday(totals, 1)))
    expect(keys(farmTomorrow(totals, 5))).toEqual(keys(farmToday(totals, 6)))
    expect(keys(farmTomorrow(totals, 6))).toEqual(["TeachingsOfFreedom"])
  })
})

describe("upgrade rows", () => {
  const ayaka = (level: number, ascension: number) => ({
    key: "KamisatoAyaka",
    level,
    ascension,
    constellation: 0,
    talent: { auto: 1, skill: 6, burst: 6 },
  })
  const goal = (skill = 0): CharacterGoal => ({
    id: "a",
    kind: "character",
    key: "KamisatoAyaka",
    to: { stage: { level: 90, phase: 6 }, talents: { auto: 0, skill, burst: 0 } },
    order: ["skill", "burst", "auto"],
  })
  const rows = (goals: Goal[], at: Account, bag: Map<string, number>) =>
    upgradeRows(planCards({ goals, focus: "important" }, at, plannerBag(bag)))

  it("name an ascension and what must be combined for it", () => {
    const bag = new Map([
      ["ShivadaJadeGemstone", 3],
      ["ShivadaJadeChunk", 9],
      ["FamedHandguard", 24],
      ["PerpetualHeart", 20],
      ["SakuraBloom", 60],
      ["Mora", 10_000_000],
    ])
    const [row] = rows([goal()], account([ayaka(80, 5)]), bag)
    expect(row?.card.goal.id).toBe("a")
    expect(row?.target).toEqual({ kind: "ascend", level: 80, cap: 90 })
    expect(row?.combine).toEqual([{ key: "ShivadaJadeGemstone", count: 3 }])
  })

  it("name levelling to the cap, nothing to combine", () => {
    const bag = new Map([
      ["HerosWit", 400],
      ["Mora", 10_000_000],
    ])
    const [row] = rows([goal()], account([ayaka(80, 6)]), bag)
    expect(row?.target).toEqual({ kind: "level", level: 90, cap: 90 })
    expect(row?.combine).toEqual([])
  })

  it("name a talent's next level, combined only past what the bag holds for the step", () => {
    const bag = new Map([
      ["PhilosophiesOfElegance", 1],
      ["GuideToElegance", 9],
      ["BloodjadeBranch", 2],
      ["FamedHandguard", 10],
      ["Mora", 10_000_000],
    ])
    const [row] = rows([goal(8)], account([ayaka(90, 6)]), bag)
    expect(row?.target).toEqual({ kind: "talent", talent: "skill", from: 6, to: 7 })
    expect(row?.combine).toEqual([{ key: "PhilosophiesOfElegance", count: 3 }])
    const [direct] = rows(
      [goal(8)],
      account([ayaka(90, 6)]),
      new Map([...bag, ["PhilosophiesOfElegance", 4]]),
    )
    expect(direct?.combine).toEqual([])
  })

  it("name what must be converted for a step, past what combining makes", () => {
    const bag = new Map([
      ["ShivadaJadeGemstone", 2],
      ["ShivadaJadeChunk", 3],
      ["AgnidusAgateGemstone", 5],
      ["FamedHandguard", 24],
      ["PerpetualHeart", 20],
      ["SakuraBloom", 60],
      ["Mora", 10_000_000],
      ["DustOfAzoth", 100],
    ])
    const plan = { goals: [goal()], focus: "important" as const, convert: ["gem" as const] }
    const [row] = upgradeRows(planCards(plan, account([ayaka(80, 5)]), plannerBag(bag)))
    expect(row?.target).toEqual({ kind: "ascend", level: 80, cap: 90 })
    expect(row?.combine).toEqual([{ key: "ShivadaJadeGemstone", count: 1 }])
    expect(row?.convert).toEqual([{ key: "ShivadaJadeGemstone", count: 3 }])
  })

  it("take each goal's first step in card order, six at most, none off or done", () => {
    const sword = (id: string, over: Partial<WeaponGoal> = {}): WeaponGoal => ({
      id,
      kind: "weapon",
      key: "FavoniusSword",
      to: { level: 20, phase: 0 },
      ...over,
    })
    const goals = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(id =>
      sword(id, id === "2" ? { off: true } : id === "4" ? { to: { level: 1, phase: 0 } } : {}),
    )
    const bag = new Map([
      ["MysticEnhancementOre", 100],
      ["Mora", 10_000_000],
    ])
    const list = rows(goals, account([]), bag)
    expect(list.map(row => row.card.goal.id)).toEqual(["1", "3", "5", "6", "7", "8"])
    expect(list[0]?.target).toEqual({ kind: "level", level: 20, cap: 20 })
  })
})
