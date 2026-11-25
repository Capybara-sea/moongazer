// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { parseAccount } from "./account"
import {
  byCharacter,
  COMPANION_PRIMOGEMS,
  COMPANION_TOTAL,
  claimNeed,
  FURNISHING_SETS,
  type FurnishingView,
  furnishingInfo,
  furnishingView,
  type SetRow,
  type UnitRow,
} from "./furnishing"

// A gift set with two companions, and a set with something to make and something to buy.
const gift = FURNISHING_SETS.find(s => s.companions.length >= 2)
const mixed = FURNISHING_SETS.find(s => {
  const kinds = s.units.map(([id = 0]) => furnishingInfo(id))
  return kinds.some(f => f?.recipe) && kinds.some(f => !f?.recipe)
})
if (!gift || !mixed) throw new Error("the bundled table has no such sets")
const [first, second] = gift.companions
if (!first || !second) throw new Error("the gift set has fewer than two companions")

function account(fields: Record<string, unknown>) {
  return parseAccount({ format: "GOOD", ...fields })
}

describe("the furnishing sets table", () => {
  it("has the 79 gift sets only, each with a companion", () => {
    expect(FURNISHING_SETS.length).toBeGreaterThanOrEqual(79)
    expect(FURNISHING_SETS.every(s => s.companions.length > 0)).toBe(true)
    expect(COMPANION_TOTAL).toBeGreaterThanOrEqual(232)
    expect(COMPANION_PRIMOGEMS).toBe(20)
  })
})

describe("furnishingView", () => {
  it("counts the sets learned, and the companions' rewards by who is owned", () => {
    const view = furnishingView(
      account({
        characters: [{ key: first.character, level: 1 }],
        gi_collections: {
          furnishingSets: [gift.id, 31],
          companionRewards: [second.event],
        },
      }),
    )
    const row = view.rows.find(r => r.info.id === gift.id)
    expect(view.learned).toBe(1)
    expect(row?.companions.find(c => c.event === first.event)?.status).toBe("claimable")
    expect(row?.companions.find(c => c.event === second.event)?.status).toBe("claimed")
    expect(view.claimed).toBe(1)
    expect(view.claimable).toBeGreaterThanOrEqual(1)
    expect(view.bag).toBe(false)
    expect(view.whole).toBeUndefined()
  })

  it("tells what the bag lacks and how each lacking piece is come by", () => {
    const made = mixed.units.find(([id = 0]) => furnishingInfo(id)?.recipe)
    const [madeId = 0] = made ?? []
    const furnishings = Object.fromEntries(mixed.units.map(([id = 0, need = 0]) => [id, need]))
    furnishings[madeId] = 0
    const view = furnishingView(
      account({
        gi_collections: { blueprints: [madeId] },
        mg_furnishings: furnishings,
      }),
    )
    const row = view.rows.find(r => r.info.id === mixed.id)
    const unit = row?.units.find(u => u.id === madeId)
    expect(unit?.getting).toBe("craft")
    expect(unit?.short).toBe(unit?.need)
    expect(row?.short).toEqual({ kinds: 1, pieces: unit?.need, buy: 0, blueprint: 0 })
    const recipe = furnishingInfo(madeId)?.recipe ?? {}
    expect(row?.materials.map(m => m.key).sort()).toEqual(Object.keys(recipe).sort())
    expect(view.bag).toBe(true)
    expect(view.craftable).toBeGreaterThanOrEqual(1)
  })

  it("prices the whole set's making without the bag's counts, for learned blueprints only", () => {
    const blueprints = mixed.units.map(([id = 0]) => id)
    const learned = furnishingView(account({ gi_collections: { blueprints } }))
    const row = learned.rows.find(r => r.info.id === mixed.id)
    expect(row?.short).toBeUndefined()
    expect(row?.units.every(u => u.have === undefined)).toBe(true)
    expect(row?.materials.length).toBeGreaterThan(0)
    const none = furnishingView(account({})).rows.find(r => r.info.id === mixed.id)
    expect(none?.materials).toEqual([])
  })
})

describe("byCharacter", () => {
  it("lists owned characters with rewards left, leaving out the claimed and the not owned", () => {
    const owned = [first.character, second.character]
    const view = furnishingView(
      account({
        characters: owned.map(key => ({ key, level: 1 })),
        gi_collections: { companionRewards: [second.event] },
      }),
    )
    const people = byCharacter(view.rows)
    expect(people.every(p => owned.includes(p.character))).toBe(true)
    const firstSets = people.find(p => p.character === first.character)?.sets ?? []
    expect(firstSets.some(set => set.info.id === gift.id)).toBe(true)
    const secondSets = people.find(p => p.character === second.character)?.sets ?? []
    expect(secondSets.some(set => set.info.id === gift.id)).toBe(false)
    expect(people[0]?.sets.length).toBeGreaterThanOrEqual(people.at(-1)?.sets.length ?? 0)
  })
})

describe("claimNeed", () => {
  const unit = (id: number, need: number, have: number): UnitRow => ({
    id,
    info: { name: "", rarity: 1 },
    need,
    getting: "craft",
    have,
  })
  const row = (claimable: number, units: UnitRow[]): SetRow => ({
    info: gift,
    learned: true,
    units,
    companions: [],
    claimable,
    materials: [],
  })
  const view = (rows: SetRow[], bag: boolean): FurnishingView => ({
    rows,
    learned: 0,
    claimed: 0,
    claimable: 0,
    bag,
  })

  it("takes each furnishing at the most one set needs, of the sets with rewards left", () => {
    const rows = [
      row(1, [unit(1, 2, 1), unit(2, 1, 1)]),
      row(2, [unit(1, 3, 1)]),
      row(0, [unit(1, 9, 1), unit(3, 5, 0)]),
    ]
    const need = claimNeed(view(rows, true))
    expect(need.lacking).toBe(1)
    expect(need.items.map(u => [u.id, u.need, u.short, u.sets.length])).toEqual([
      [1, 3, 2, 2],
      [2, 1, 0, 1],
    ])
  })

  it("leaves the shortage out without the bag's counts", () => {
    expect(claimNeed(view([row(1, [unit(1, 2, 0)])], false)).lacking).toBeUndefined()
  })
})
