// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import type { Character, Weapon } from "@/domain/good"
import {
  type CharacterGoal,
  type CustomGoal,
  type CustomWeaponGoal,
  EMPTY_PLAN,
  type Goal,
  type Plan,
  planCards,
  type WeaponGoal,
} from "@/domain/plan"
import { moveGoal, replaceCustom, replaceCustomWeapon, setGoalOff } from "@/domain/planEdits"
import { START, type Stage, weaponNeed } from "@/domain/planner"
import { parsePlan } from "@/domain/savedPlan"

const TOP: Stage = { level: 90, phase: 6 }

function account(characters: Character[] = [], weapons: Weapon[] = []): Account {
  return { characters, weapons, artifacts: [], materials: new Map(), characterInfo: new Map() }
}

const sword = (id: string, over: Partial<WeaponGoal> = {}): WeaponGoal => ({
  id,
  kind: "weapon",
  key: "MistsplitterReforged",
  to: TOP,
  ...over,
})
const character = (id: string, key: string, level: number, phase: number): CharacterGoal => ({
  id,
  kind: "character",
  key,
  to: { stage: { level, phase }, talents: { auto: 0, skill: 0, burst: 0 } },
})
const plan = (goals: Goal[]): Plan => ({ ...EMPTY_PLAN, goals })

describe("goals switched off", () => {
  // Just what one sword takes from 1 to 90.
  const bag = weaponNeed("MistsplitterReforged", 5, START.stage, TOP)
  const cards = (goals: Goal[]) => planCards({ goals, focus: "ready" }, account(), bag)

  it("take nothing, so the cards after them share the bag as if they were not there", () => {
    const [first, second] = cards([sword("a", { off: true }), sword("b")])
    const [alone] = cards([sword("b")])
    expect(first).toMatchObject({ off: true, lines: [], done: false, steps: [] })
    expect(second?.off).toBe(false)
    expect(second?.lines).toEqual(alone?.lines)
    expect(second?.lines.every(l => l.have === l.need)).toBe(true)
    expect(second?.steps).toEqual([{ kind: "level", to: { level: 20, phase: 0 } }])
    const [, behind] = cards([sword("a"), sword("b")])
    expect(behind?.lines.every(l => l.have === 0)).toBe(true)
  })

  it("still say what they would cost, but are never done and raise nothing", () => {
    const at90: Weapon = {
      key: "MistsplitterReforged",
      level: 90,
      ascension: 6,
      refinement: 1,
      location: "",
      lock: false,
      guid: "1",
    }
    const owned = account([], [at90])
    const reached = sword("a", { guid: "1" })
    expect(planCards({ goals: [reached], focus: "ready" }, owned, bag)[0]?.done).toBe(true)
    const [off] = planCards({ goals: [{ ...reached, off: true }], focus: "ready" }, owned, bag)
    expect(off).toMatchObject({ done: false, steps: [] })
    const [ready] = cards([sword("a", { off: true })])
    expect(ready?.need.get("GoldenBranchOfADistantSea")).toBe(6)
    expect(ready?.steps).toEqual([])
  })

  it("do not raise the level the Traveler's elements share for the cards after them", () => {
    const traveler: Character = {
      key: "TravelerAnemo",
      level: 70,
      ascension: 5,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
    }
    const goals = [
      { ...character("a", "TravelerAnemo", 90, 6), off: true },
      character("g", "TravelerGeo", 90, 6),
    ]
    const [, geo] = planCards({ goals, focus: "ready" }, account([traveler]), new Map())
    expect(geo?.need.get("BrilliantDiamondGemstone")).toBe(6)
  })
})

describe("moving goals", () => {
  const goals = [sword("a"), sword("b"), sword("c")]
  const ids = (moved: Plan) => moved.goals.map(g => g.id).join("")

  it("drops a goal where it is dragged to", () => {
    expect(ids(moveGoal(plan(goals), 0, 2))).toBe("bca")
    expect(ids(moveGoal(plan(goals), 2, 0))).toBe("cab")
    expect(ids(moveGoal(plan(goals), 1, 2))).toBe("acb")
    expect(ids(moveGoal(plan(goals), 1, 0))).toBe("bac")
  })

  it("leaves the plan as it was in place or out of range", () => {
    const before = plan(goals)
    for (const [from, to] of [
      [1, 1],
      [-1, 0],
      [3, 0],
      [0, -1],
      [0, 3],
    ] as const) {
      expect(moveGoal(before, from, to)).toBe(before)
    }
    expect(ids(before)).toBe("abc")
  })
})

describe("switching goals off", () => {
  it("marks only that goal, and leaves nothing behind when it is back on", () => {
    const before = plan([sword("a"), sword("b")])
    const off = setGoalOff(before, "b", true)
    expect(off.goals.map(g => g.off)).toEqual([undefined, true])
    expect(before.goals[1]?.off).toBeUndefined()
    const on = setGoalOff(off, "b", false)
    expect(JSON.parse(JSON.stringify(on))).toEqual(JSON.parse(JSON.stringify(before)))
    expect(setGoalOff(before, "x", true).goals).toEqual(before.goals)
  })
})

describe("saved goals", () => {
  const custom: CustomGoal = {
    id: "c",
    kind: "custom",
    name: "Newcomer",
    rarity: 5,
    slots: {},
    to: { stage: TOP, talents: { auto: 0, skill: 9, burst: 9 } },
  }
  const customWeapon: CustomWeaponGoal = {
    id: "w",
    kind: "customWeapon",
    name: "Newblade",
    rarity: 4,
    slots: {},
    to: TOP,
  }
  const every: Goal[] = [character("a", "KamisatoAyaka", 90, 6), sword("s"), custom, customWeapon]

  it("keep being off for every kind, and only when saved as true", () => {
    const saved = every.flatMap(g => [
      { ...g, off: true },
      { ...g, id: `${g.id}2`, off: "true" },
    ])
    expect(parsePlan({ goals: saved }).goals.map(g => g.off)).toEqual([
      true,
      undefined,
      true,
      undefined,
      true,
      undefined,
      true,
      undefined,
    ])
  })

  it("from before goals could be off or boosted read back and save as they were", () => {
    const old = JSON.parse(JSON.stringify({ goals: every, focus: "ready", defaults: {} }))
    const read = parsePlan(old)
    expect(read.goals.every(g => g.off === undefined)).toBe(true)
    expect(JSON.parse(JSON.stringify(read.goals))).toEqual(old.goals)
  })

  it("keep being off and boosted when a custom one turns into the released one", () => {
    const off = plan([{ ...custom, off: true }])
    expect(replaceCustom(off, "c", "KamisatoAyaka").goals[0]).toMatchObject({
      kind: "character",
      off: true,
    })
    const boosted = plan([{ ...customWeapon, type: "sword", off: true, expBoost: true }])
    const [turned] = replaceCustomWeapon(boosted, "w", { key: "TheAlleyFlash" }, account()).goals
    expect(turned).toMatchObject({ kind: "weapon", off: true, expBoost: true })
    expect(turned && "type" in turned).toBe(false)
  })
})
