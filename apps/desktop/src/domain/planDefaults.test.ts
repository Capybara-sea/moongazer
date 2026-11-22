// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { characterFrom } from "@/domain/plan"
import { characterTarget, DEFAULTS, type Defaults, weaponTarget } from "@/domain/planDefaults"
import { characterCaps, defaultOrder, START, TALENTS, weaponCaps } from "@/domain/planner"
import { parsePlan } from "@/domain/savedPlan"

const TOP = { level: 90, phase: 6 }
const withLevel = (level: number, phase: number): Defaults => ({
  ...DEFAULTS,
  character: { ...DEFAULTS.character, stage: { level, phase } },
})

describe("defaults", () => {
  it("are level 90, talents 9, 9 and 6, and full weapons in plans saved before them", () => {
    expect(parsePlan({ goals: [], focus: "ready" }).defaults).toEqual({
      character: { stage: TOP, talents: [9, 9, 6] },
      weapon: TOP,
    })
  })

  it("fall back one by one where they do not check out", () => {
    const saved = {
      character: { stage: { level: 80, phase: 6 }, talents: [10, 0, "8"] },
      weapon: { level: 35, phase: 2 },
    }
    expect(parsePlan({ defaults: saved }).defaults).toEqual({
      character: { stage: { level: 80, phase: 6 }, talents: [10, 9, 6] },
      weapon: TOP,
    })
    const other = {
      character: { stage: { level: 90, phase: 5 }, talents: [1, 1, 1] },
      weapon: { level: 70, phase: 4 },
    }
    expect(parsePlan({ defaults: other }).defaults).toEqual({
      character: { stage: TOP, talents: [1, 1, 1] },
      weapon: { level: 70, phase: 4 },
    })
    expect(parsePlan({ defaults: { character: 3, weapon: "90" } }).defaults).toEqual(DEFAULTS)
  })
})

describe("new character goals", () => {
  const caps = characterCaps()

  it("aim at each talent's default by rank, leaving the ones there already", () => {
    const from = { stage: { level: 80, phase: 6 }, talents: { auto: 1, skill: 10, burst: 6 } }
    expect(characterTarget(DEFAULTS, from, ["burst", "skill", "auto"], caps)).toEqual({
      stage: TOP,
      talents: { auto: 6, skill: 0, burst: 9 },
    })
  })

  it("keep a level past the default, and raise a low one as far as the talents need", () => {
    // Talent 9 needs the sixth ascension, done at level 80 (80★).
    expect(characterTarget(withLevel(20, 0), START, TALENTS, caps).stage).toEqual({
      level: 80,
      phase: 6,
    })
    const sixes: Defaults = { ...DEFAULTS, character: { stage: START.stage, talents: [6, 6, 6] } }
    expect(characterTarget(sixes, START, TALENTS, caps).stage).toEqual({ level: 60, phase: 4 })
    const raised = { stage: { level: 80, phase: 6 }, talents: { auto: 10, skill: 10, burst: 9 } }
    expect(characterTarget(withLevel(40, 2), raised, TALENTS, caps)).toEqual({
      stage: { level: 80, phase: 6 },
      talents: { auto: 0, skill: 0, burst: 0 },
    })
  })

  it("rank an unowned character's talents by its order, a custom one's in the game's", () => {
    const empty: Account = {
      characters: [],
      weapons: [],
      artifacts: [],
      materials: new Map(),
      characterInfo: new Map(),
    }
    const [from] = characterFrom(empty, "KamisatoAyaka")
    const order = defaultOrder("KamisatoAyaka")
    const unowned = characterTarget(DEFAULTS, from, order, caps)
    expect(unowned.stage).toEqual(TOP)
    expect(order.map(talent => unowned.talents[talent])).toEqual([9, 9, 6])
    expect(characterTarget(DEFAULTS, START, TALENTS, caps)).toEqual({
      stage: TOP,
      talents: { auto: 9, skill: 9, burst: 6 },
    })
  })
})

describe("new weapon goals", () => {
  it("stop at a 1-star weapon's top", () => {
    expect(weaponTarget(DEFAULTS, START.stage, weaponCaps(1))).toEqual({ level: 70, phase: 4 })
  })

  it("stay where a weapon past the default is", () => {
    const sixty = { ...DEFAULTS, weapon: { level: 60, phase: 4 } }
    expect(weaponTarget(sixty, START.stage, weaponCaps(5))).toEqual({ level: 60, phase: 4 })
    expect(weaponTarget(sixty, { level: 80, phase: 5 }, weaponCaps(5))).toEqual({
      level: 80,
      phase: 5,
    })
  })
})
