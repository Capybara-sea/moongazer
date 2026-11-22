// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { type ConvertKind, convertShort, isConvertCost } from "@/domain/convert"
import { type CharacterGoal, materialTotals, planCards, summaryGroup } from "@/domain/plan"
import { allocate, type Line, plannerBag } from "@/domain/planner"
import { parsePlan } from "@/domain/savedPlan"

const DUST = "DustOfAzoth"
const SOLVENT = "DreamSolvent"

/** The bag shared among cards needing `needs` in order, then converted as `kinds` allow. */
function convert(
  needs: [string, number][][],
  bag: [string, number][],
  kinds: ConvertKind[] = ["gem"],
) {
  const held = new Map(bag)
  return convertShort(
    allocate(
      needs.map(need => new Map(need)),
      held,
    ),
    held,
    kinds,
  )
}

const lineOf = (lines: Line[] | undefined, key: string) => lines?.find(line => line.key === key)

describe("converting gems", () => {
  it("fills a tier's shortfall from the other element the bag holds most of", () => {
    const [card] = convert(
      [[["AgnidusAgateChunk", 3]]],
      [
        ["AgnidusAgateChunk", 1],
        ["VarunadaLazuriteChunk", 5],
        ["ShivadaJadeChunk", 8],
        [DUST, 100],
      ],
    )
    expect(lineOf(card, "AgnidusAgateChunk")).toMatchObject({ need: 3, have: 3, made: 0 })
    expect(lineOf(card, "AgnidusAgateChunk")?.converted).toEqual({
      count: 2,
      from: new Map([["ShivadaJadeChunk", 2]]),
      cost: DUST,
      paid: 18,
    })
    expect(lineOf(card, DUST)).toEqual({
      key: DUST,
      need: 18,
      have: 18,
      made: 0,
      used: new Map(),
      bag: 100,
    })
  })

  it("takes first from the element the bag holds most of over all four tiers", () => {
    const [card] = convert(
      [[["AgnidusAgateChunk", 2]]],
      [
        ["VarunadaLazuriteChunk", 6],
        ["ShivadaJadeChunk", 3],
        ["ShivadaJadeGemstone", 2],
        [DUST, 100],
      ],
    )
    // Cryo holds 3 x 9 + 2 x 27 = 81 slivers' worth, Hydro 6 x 9 = 54.
    expect(lineOf(card, "AgnidusAgateChunk")?.converted?.from).toEqual(
      new Map([["ShivadaJadeChunk", 2]]),
    )
  })

  it("combines the same element's tier below first and converts only the rest", () => {
    const [card] = convert(
      [[["AgnidusAgateChunk", 3]]],
      [
        ["AgnidusAgateChunk", 1],
        ["AgnidusAgateFragment", 3],
        ["ShivadaJadeChunk", 5],
        ["Mora", 100_000],
        [DUST, 100],
      ],
    )
    const line = lineOf(card, "AgnidusAgateChunk")
    expect(line).toMatchObject({ need: 3, have: 3, made: 1 })
    expect(line?.converted?.count).toBe(1)
    expect(lineOf(card, DUST)?.need).toBe(9)
  })

  it("converts only what no card needs, whichever card comes first", () => {
    const [first, second] = convert(
      [[["AgnidusAgateChunk", 2]], [["ShivadaJadeChunk", 4]]],
      [
        ["ShivadaJadeChunk", 5],
        ["VarunadaLazuriteChunk", 1],
        [DUST, 100],
      ],
    )
    expect(lineOf(first, "AgnidusAgateChunk")?.converted?.from).toEqual(
      new Map([
        ["ShivadaJadeChunk", 1],
        ["VarunadaLazuriteChunk", 1],
      ]),
    )
    expect(lineOf(second, "ShivadaJadeChunk")).toMatchObject({ need: 4, have: 4 })
    expect(lineOf(second, "ShivadaJadeChunk")?.converted).toBeUndefined()
  })

  it("stops at what the dust left pays for, the cards in order", () => {
    const needs: [string, number][][] = [
      [["PrithivaTopazGemstone", 2]],
      [["AgnidusAgateGemstone", 1]],
    ]
    const [first, second] = convert(needs, [
      ["ShivadaJadeGemstone", 10],
      [DUST, 60],
    ])
    expect(lineOf(first, "PrithivaTopazGemstone")).toMatchObject({ need: 2, have: 2 })
    expect(lineOf(first, DUST)?.need).toBe(54)
    expect(lineOf(second, "AgnidusAgateGemstone")).toMatchObject({ need: 1, have: 0 })
    expect(lineOf(second, DUST)).toBeUndefined()

    const [partial] = convert(needs, [
      ["ShivadaJadeGemstone", 10],
      [DUST, 30],
    ])
    expect(lineOf(partial, "PrithivaTopazGemstone")).toMatchObject({ need: 2, have: 1 })
    expect(lineOf(partial, DUST)).toMatchObject({ need: 27, have: 27, bag: 30 })
  })

  it("never converts into another tier, nor the Traveler's gems", () => {
    // The gemstone left over would cover the diamond too, were it in the group.
    const [card] = convert(
      [
        [
          ["AgnidusAgateGemstone", 1],
          ["BrilliantDiamondGemstone", 1],
        ],
      ],
      [
        ["ShivadaJadeChunk", 9],
        ["ShivadaJadeGemstone", 2],
        [DUST, 1000],
      ],
    )
    expect(lineOf(card, "AgnidusAgateGemstone")?.converted?.from).toEqual(
      new Map([["ShivadaJadeGemstone", 1]]),
    )
    expect(lineOf(card, "BrilliantDiamondGemstone")).toMatchObject({ need: 1, have: 0 })
    expect(lineOf(card, "BrilliantDiamondGemstone")?.converted).toBeUndefined()
    expect(lineOf(card, DUST)?.need).toBe(27)
  })
})

describe("converting weekly boss drops", () => {
  const bag: [string, number][] = [
    ["DvalinsClaw", 2],
    ["DvalinsSigh", 4],
    ["TailOfBoreas", 10],
    [SOLVENT, 10],
  ]

  it("converts the same boss's other drops only, for a solvent each", () => {
    const [card] = convert([[["DvalinsPlume", 5]]], bag, ["weekly"])
    expect(lineOf(card, "DvalinsPlume")?.converted).toEqual({
      count: 5,
      from: new Map([
        ["DvalinsSigh", 4],
        ["DvalinsClaw", 1],
      ]),
      cost: SOLVENT,
      paid: 5,
    })
    expect(lineOf(card, SOLVENT)).toMatchObject({ need: 5, have: 5 })
    expect(convert([[["DvalinsPlume", 7]]], bag, ["weekly"])[0]?.[0]?.have).toBe(6)
  })

  it("converts only the kinds allowed", () => {
    const [card] = convert([[["DvalinsPlume", 5]]], bag, ["gem"])
    expect(card).toEqual([
      { key: "DvalinsPlume", need: 5, have: 0, made: 0, bag: 0, used: new Map() },
    ])
  })
})

describe("plans that allow converting", () => {
  const ayaka = {
    key: "KamisatoAyaka",
    level: 80,
    ascension: 5,
    constellation: 0,
    talent: { auto: 1, skill: 6, burst: 6 },
  }
  const account: Account = {
    characters: [ayaka],
    weapons: [],
    artifacts: [],
    materials: new Map(),
    characterInfo: new Map(),
  }
  const goal: CharacterGoal = {
    id: "a",
    kind: "character",
    key: "KamisatoAyaka",
    to: { stage: { level: 80, phase: 6 }, talents: { auto: 0, skill: 0, burst: 0 } },
  }
  const bag = plannerBag(
    new Map([
      ["ShivadaJadeGemstone", 2],
      ["AgnidusAgateGemstone", 5],
      ["VarunadaLazuriteGemstone", 9],
      ["FamedHandguard", 24],
      ["PerpetualHeart", 20],
      ["SakuraBloom", 60],
      ["Mora", 10_000_000],
      [DUST, 200],
    ]),
  )
  const plan = { goals: [goal], focus: "important" as const }

  it("change nothing while no conversion is allowed", () => {
    const today = planCards(plan, account, bag)
    expect(planCards({ ...plan, convert: [] }, account, bag)).toEqual(today)
    expect(planCards({ ...plan, convert: ["weekly"] }, account, bag)).toEqual(today)
    expect(today[0]?.steps).toEqual([])
  })

  it("count converted gems in, with the dust beside the ascension's materials", () => {
    const [card] = planCards({ ...plan, convert: ["gem"] }, account, bag)
    const gem = lineOf(card?.lines, "ShivadaJadeGemstone")
    expect(gem).toMatchObject({ need: 6, have: 6 })
    expect(gem?.converted?.from).toEqual(new Map([["VarunadaLazuriteGemstone", 4]]))
    expect(lineOf(card?.lines, DUST)?.need).toBe(108)
    expect(card?.stageKeys.has(DUST)).toBe(true)
    expect(card?.steps).toEqual([{ kind: "ascend", to: { level: 80, phase: 6 } }])
    const totals = materialTotals(card ? [card] : [])
    expect(totals.get(DUST)).toMatchObject({ need: 108, have: 108 })
    expect(summaryGroup(DUST)).toBe(summaryGroup("ShivadaJadeGemstone"))
    expect(summaryGroup(SOLVENT)).toBe(summaryGroup("DvalinsPlume"))
    expect(isConvertCost(DUST) && isConvertCost(SOLVENT)).toBe(true)
  })

  it("are read back with the kinds known, in order, once each", () => {
    expect(parsePlan({ convert: ["weekly", "gem", "other", "gem"] }).convert).toEqual([
      "gem",
      "weekly",
    ])
    expect(parsePlan({ convert: [] }).convert).toBeUndefined()
    expect(parsePlan({ convert: "gem" }).convert).toBeUndefined()
    expect(parsePlan({}).convert).toBeUndefined()
  })
})
