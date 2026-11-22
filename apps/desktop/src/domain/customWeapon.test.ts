// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { isUnknown, unknownSlot } from "@/domain/customCharacter"
import {
  type CustomWeaponSlots,
  customWeaponNeed,
  WEAPON_SLOTS,
  weaponFamilyOptions,
} from "@/domain/customWeapon"
import type { Weapon } from "@/domain/good"
import {
  type CustomWeaponGoal,
  EMPTY_PLAN,
  goalName,
  planCards,
  type WeaponGoal,
  type WeaponPick,
} from "@/domain/plan"
import { replaceCustomWeapon } from "@/domain/planEdits"
import {
  type Need,
  plannerBag,
  START,
  type Stage,
  WEAPON_EXP,
  weaponCaps,
  weaponNeed,
} from "@/domain/planner"
import { parsePlan } from "@/domain/savedPlan"

const TOP: Stage = { level: 90, phase: 6 }
const sorted = (need: Need) => [...need].toSorted(([a], [b]) => a.localeCompare(b))

function account(weapons: Weapon[] = []): Account {
  return {
    characters: [],
    weapons,
    artifacts: [],
    materials: new Map(),
    characterInfo: new Map(),
  }
}

/** The families a released weapon's materials come from, as a custom weapon names them. */
function slotsOf(key: string, rarity: number): CustomWeaponSlots {
  const need = weaponNeed(key, rarity, START.stage, TOP)
  const slots: CustomWeaponSlots = {}
  for (const slot of WEAPON_SLOTS) {
    slots[slot] = weaponFamilyOptions(slot)
      .find(family => family.some(item => need.has(item)))
      ?.at(-1)
  }
  return slots
}

describe("custom weapons", () => {
  const mistsplitter = {
    weapon: "GoldenBranchOfADistantSea",
    elite: "ChaosOculus",
    common: "FamedHandguard",
  }

  it("cost what a released weapon of the same rarity and materials costs", () => {
    expect(slotsOf("MistsplitterReforged", 5)).toEqual(mistsplitter)
    const ranges: [Stage, Stage][] = [
      [START.stage, TOP],
      [
        { level: 40, phase: 2 },
        { level: 80, phase: 6 },
      ],
    ]
    for (const [from, to] of ranges) {
      expect(sorted(customWeaponNeed(5, mistsplitter, from, to))).toEqual(
        sorted(weaponNeed("MistsplitterReforged", 5, from, to)),
      )
    }
  })

  it.each([
    ["TheAlleyFlash", 4],
    ["HarbingerOfDawn", 3],
  ])("cost what %s does at its %i stars", (key, rarity) => {
    const slots = slotsOf(key, rarity)
    expect(WEAPON_SLOTS.every(slot => slots[slot])).toBe(true)
    expect(sorted(customWeaponNeed(rarity, slots, START.stage, TOP))).toEqual(
      sorted(weaponNeed(key, rarity, START.stage, TOP)),
    )
  })

  it("count a slot not known yet under its tier, apart from a custom character's", () => {
    const need = customWeaponNeed(5, { weapon: mistsplitter.weapon }, START.stage, TOP)
    const released = weaponNeed("MistsplitterReforged", 5, START.stage, TOP)
    expect(need.get(mistsplitter.weapon)).toBe(6)
    expect(need.get("?w-elite:0")).toBe(5 + 18)
    expect(need.get("?w-common:2")).toBe(9 + 18)
    expect(need.get("Mora")).toBe(released.get("Mora"))
    expect(need.get(WEAPON_EXP)).toBe(released.get(WEAPON_EXP))
    expect([...need.keys()].filter(isUnknown).toSorted()).toEqual([
      "?w-common:0",
      "?w-common:1",
      "?w-common:2",
      "?w-elite:0",
      "?w-elite:1",
      "?w-elite:2",
    ])
    expect(unknownSlot("?w-common:2")).toEqual({ of: "weapon", slot: "common", tier: 2 })
    expect(unknownSlot("?common:2")).toEqual({ of: "character", slot: "common", tier: 2 })
    expect(unknownSlot("?w-gem:0")).toBeUndefined()
  })
})

describe("custom weapon goals", () => {
  const custom: CustomWeaponGoal = {
    id: "w",
    kind: "customWeapon",
    name: "Newblade",
    rarity: 4,
    slots: { elite: "ChaosOculus" },
    to: { level: 80, phase: 6 },
  }
  const sword = (location: string, guid?: string): Weapon => ({
    key: "FavoniusSword",
    level: 90,
    ascension: 6,
    refinement: 1,
    location,
    lock: false,
    guid,
  })

  it("keep what checks out, a slot of no known family left not known", () => {
    const saved = {
      ...custom,
      name: " Newblade ",
      slots: { ...custom.slots, weapon: "OldBranch", common: 3, gem: "ShivadaJadeGemstone" },
    }
    expect(parsePlan({ goals: [saved] }).goals).toEqual([custom])
    const bad = [
      { ...custom, rarity: 2 },
      { ...custom, rarity: "4" },
      { ...custom, name: " " },
      { ...custom, to: { stage: TOP, talents: { auto: 0, skill: 0, burst: 0 } } },
    ]
    expect(parsePlan({ goals: bad }).goals).toEqual([])
  })

  it("start from level 1, cost by rarity and get nothing of a material not known yet", () => {
    const bag = plannerBag(
      new Map([
        ["MysticEnhancementOre", 100],
        ["Mora", 10_000_000],
        ["ChaosGear", 10],
      ]),
    )
    const [card] = planCards({ goals: [custom], focus: "ready" }, account(), bag)
    expect(card?.standing).toBe("custom")
    expect(card?.from).toEqual(START)
    expect(card?.caps).toEqual(weaponCaps(4))
    expect(goalName(custom)).toBe("Newblade")
    const released = weaponNeed("TheAlleyFlash", 4, START.stage, custom.to)
    expect(card?.need.get(WEAPON_EXP)).toBe(released.get(WEAPON_EXP))
    const unknown = card?.lines.filter(l => isUnknown(l.key)) ?? []
    expect(unknown.map(l => l.key)).toContain("?w-weapon:0")
    expect(unknown.every(l => l.have === 0)).toBe(true)
    expect(card?.lines.find(l => l.key === "ChaosGear")).toMatchObject({ need: 3 + 12, have: 10 })
    // Levelling to 20 takes EXP and Mora alone.
    expect(card?.steps).toEqual([{ kind: "level", to: { level: 20, phase: 0 } }])
  })

  it("turn into a released weapon, the level goal kept as far as it goes", () => {
    const plan = { ...EMPTY_PLAN, goals: [{ ...custom, to: TOP }] }
    const dull = replaceCustomWeapon(plan, "w", { key: "DullBlade" }, account())
    expect(dull.goals).toEqual([
      { id: "w", kind: "weapon", key: "DullBlade", to: { level: 70, phase: 4 } },
    ])
    const pick = { key: "FavoniusSword", guid: "9", wielder: "Bennett", copy: 0 }
    const owned = replaceCustomWeapon(plan, "w", pick, account([sword("Bennett", "9")]))
    expect(owned.goals).toEqual([{ id: "w", kind: "weapon", ...pick, to: TOP }])
    expect(replaceCustomWeapon(plan, "other", { key: "DullBlade" }, account()).goals).toEqual(
      plan.goals,
    )
  })

  it("do not turn into a weapon planned already or one without data", () => {
    const planned: WeaponGoal[] = [
      { id: "f", kind: "weapon", key: "FavoniusSword", guid: "9", wielder: "Bennett", to: TOP },
      { id: "d", kind: "weapon", key: "DullBlade", to: TOP },
    ]
    const plan = { ...EMPTY_PLAN, goals: [custom, ...planned] }
    const withIds = account([sword("Bennett", "9"), sword("", "8")])
    const turned = (pick: WeaponPick, owned = withIds) =>
      replaceCustomWeapon(plan, "w", pick, owned) !== plan
    const favonius = (wielder: string, guid?: string) => ({
      key: "FavoniusSword",
      guid,
      wielder,
      copy: 0,
    })
    expect(turned({ key: "DullBlade" })).toBe(false)
    expect(turned({ key: "Nothing" })).toBe(false)
    expect(turned(favonius("Bennett", "9"))).toBe(false)
    // In files without ids the planned copy is the one with that wielder.
    expect(turned(favonius("Bennett"), account([sword("Bennett"), sword("")]))).toBe(false)
    // Another copy, and the same weapon unowned, are free.
    expect(turned(favonius("", "8"))).toBe(true)
    expect(turned({ key: "FavoniusSword" })).toBe(true)
  })
})
