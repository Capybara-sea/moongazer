// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { customWeaponNeed } from "@/domain/customWeapon"
import type { WeaponType } from "@/domain/elements"
import type { Character, Weapon } from "@/domain/good"
import { weaponData } from "@/domain/names"
import { type CustomWeaponGoal, planCards, type WeaponGoal } from "@/domain/plan"
import { raiseWeaponNeed, START, type Stage, WEAPON_EXP, weaponNeed } from "@/domain/planner"
import { parsePlan } from "@/domain/savedPlan"

const TOP: Stage = { level: 90, phase: 6 }
/** A 5-star weapon's six ascensions: 10,000 + 20,000 + 30,000 + 45,000 + 55,000 + 65,000. */
const ASCENSION_MORA = 225_000
/** A 5-star weapon's EXP from 1 to 90, and its Mora at 1 per 10. */
const EXP = 9_064_450
const EXP_MORA = 906_445

const mistsplitter = {
  weapon: "GoldenBranchOfADistantSea",
  elite: "ChaosOculus",
  common: "FamedHandguard",
}

function owner(key: string): Character {
  return {
    key,
    level: 1,
    ascension: 0,
    constellation: 0,
    talent: { auto: 1, skill: 1, burst: 1 },
  }
}

function account(owners: string[], weapons: Weapon[] = []): Account {
  return {
    characters: owners.map(owner),
    weapons,
    artifacts: [],
    materials: new Map(),
    characterInfo: new Map(),
  }
}

const goal = (key: string, over: Partial<WeaponGoal> = {}): WeaponGoal => ({
  id: key,
  kind: "weapon",
  key,
  to: TOP,
  ...over,
})
const custom = (over: Partial<CustomWeaponGoal> = {}): CustomWeaponGoal => ({
  id: "c",
  kind: "customWeapon",
  name: "Newblade",
  rarity: 5,
  slots: mistsplitter,
  to: TOP,
  ...over,
})
const cardOf = (weaponGoal: WeaponGoal | CustomWeaponGoal, owned: Account) =>
  planCards({ goals: [weaponGoal], focus: "ready" }, owned, new Map())[0]

describe("ascension Mora passives", () => {
  const keys: Record<WeaponType, string> = {
    sword: "MistsplitterReforged",
    polearm: "EngulfingLightning",
    bow: "AquaSimulacra",
    catalyst: "KagurasVerity",
    claymore: "WolfsGravestone",
  }

  it("have a 5-star weapon of each type to test with", () => {
    for (const [type, key] of Object.entries(keys)) {
      expect(weaponData(key)).toMatchObject({ type, rarity: 5 })
    }
  })

  it("halve the ascension Mora of the owner's weapon types, the EXP's Mora untouched", () => {
    const halved = (owners: string[]) =>
      Object.values(keys).map(key => {
        const card = cardOf(goal(key), account(owners))
        return [card?.moraDiscount, card?.need.get("Mora"), card?.need.get(WEAPON_EXP)]
      })
    const full = [undefined, ASCENSION_MORA + EXP_MORA, EXP]
    const half = (by: string) => [by, ASCENSION_MORA / 2 + EXP_MORA, EXP]
    expect(halved([])).toEqual([full, full, full, full, full])
    expect(halved(["RaidenShogun"])).toEqual([
      half("RaidenShogun"),
      half("RaidenShogun"),
      full,
      full,
      full,
    ])
    expect(halved(["Wanderer"])).toEqual([full, full, half("Wanderer"), half("Wanderer"), full])
    expect(halved(["Wanderer", "RaidenShogun"])).toEqual([
      half("RaidenShogun"),
      half("RaidenShogun"),
      half("Wanderer"),
      half("Wanderer"),
      full,
    ])
  })

  it("leave levelling alone", () => {
    const toTwenty = goal(keys.sword, { to: { level: 20, phase: 0 } })
    expect(cardOf(toTwenty, account(["RaidenShogun"]))?.need).toEqual(
      cardOf(toTwenty, account([]))?.need,
    )
  })

  it("count for a custom weapon once its type is known", () => {
    const mora = (over: Partial<CustomWeaponGoal>, owners: string[]) => {
      const card = cardOf(custom(over), account(owners))
      return [card?.moraDiscount, card?.need.get("Mora")]
    }
    expect(mora({ type: "polearm" }, ["RaidenShogun"])).toEqual([
      "RaidenShogun",
      ASCENSION_MORA / 2 + EXP_MORA,
    ])
    expect(mora({ type: "catalyst" }, ["Wanderer"])).toEqual([
      "Wanderer",
      ASCENSION_MORA / 2 + EXP_MORA,
    ])
    expect(mora({}, ["RaidenShogun", "Wanderer"])).toEqual([undefined, ASCENSION_MORA + EXP_MORA])
    expect(mora({ type: "claymore" }, ["RaidenShogun", "Wanderer"])).toEqual([
      undefined,
      ASCENSION_MORA + EXP_MORA,
    ])
  })

  it("round half of an odd amount up", () => {
    const need = raiseWeaponNeed(
      [{ Mora: 5 }],
      5,
      { level: 20, phase: 0 },
      { level: 20, phase: 1 },
      { halfMora: true },
    )
    expect(need.get("Mora")).toBe(3)
  })

  it("make an ascension the bag pays for only at half price a step", () => {
    const sword: Weapon = {
      key: keys.sword,
      level: 20,
      ascension: 0,
      refinement: 1,
      location: "",
      lock: false,
      guid: "1",
    }
    const ascend = goal(keys.sword, { guid: "1", to: { level: 20, phase: 1 } })
    const at20 = { level: 20, phase: 0 }
    const bag = weaponNeed(keys.sword, 5, at20, ascend.to, { halfMora: true })
    expect(bag.get("Mora")).toBe(5_000)
    const steps = (owners: string[]) =>
      planCards({ goals: [ascend], focus: "ready" }, account(owners, [sword]), bag)[0]?.steps
    expect(steps([])).toEqual([])
    expect(steps(["RaidenShogun"])).toEqual([{ kind: "ascend", to: { level: 20, phase: 1 } }])
  })
})

describe("weapon EXP x1.5", () => {
  // 9,064,450 / 1.5 rounded up, and its Mora at 1 per 10 rounded up.
  const boostedExp = 6_042_967
  const boostedMora = 604_297

  it("cuts a 5-star weapon's ore from 1 to 90 and the Mora for it, not for ascending", () => {
    const plain = weaponNeed("MistsplitterReforged", 5, START.stage, TOP)
    const boosted = weaponNeed("MistsplitterReforged", 5, START.stage, TOP, { expBoost: true })
    expect([plain.get(WEAPON_EXP), plain.get("Mora")]).toEqual([EXP, ASCENSION_MORA + EXP_MORA])
    expect([boosted.get(WEAPON_EXP), boosted.get("Mora")]).toEqual([
      boostedExp,
      ASCENSION_MORA + boostedMora,
    ])
    const rest = (need: Map<string, number>) =>
      [...need].filter(([key]) => key !== WEAPON_EXP && key !== "Mora")
    expect(rest(boosted)).toEqual(rest(plain))
  })

  it("goes with a passive's half-price ascensions", () => {
    const card = cardOf(goal("MistsplitterReforged", { expBoost: true }), account(["RaidenShogun"]))
    expect(card?.need.get(WEAPON_EXP)).toBe(boostedExp)
    expect(card?.need.get("Mora")).toBe(ASCENSION_MORA / 2 + boostedMora)
  })

  it("counts for a custom weapon as for a released one", () => {
    const boosted = customWeaponNeed(5, mistsplitter, START.stage, TOP, { expBoost: true })
    expect(boosted.get(WEAPON_EXP)).toBe(boostedExp)
    expect(cardOf(custom({ expBoost: true }), account([]))?.need).toEqual(boosted)
  })
})

describe("saved weapon goals", () => {
  it("keep the EXP boost and a custom weapon's type when they check out", () => {
    const saved = [
      goal("MistsplitterReforged", { expBoost: true }),
      { ...goal("AquaSimulacra"), expBoost: "yes" },
      custom({ type: "bow", expBoost: true }),
      { ...custom({ id: "d" }), type: "axe", expBoost: 1 },
    ]
    const goals = parsePlan({ goals: saved }).goals
    expect(
      goals.map(g => (g.kind === "weapon" || g.kind === "customWeapon") && g.expBoost),
    ).toEqual([true, undefined, true, undefined])
    expect(goals.map(g => g.kind === "customWeapon" && g.type)).toEqual([
      false,
      false,
      "bow",
      undefined,
    ])
  })
})
