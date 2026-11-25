// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The furnishing sets page's data: the game's sets from the table `cargo xtask gen-data` builds,
 * and what an account has learned, holds in its bag and has collected of the companions' rewards.
 */

import data from "@/generated/collection.json"
import type { Account } from "./account"

/** A gift set: one companions give primogems for, the only sets the page lists. */
export type FurnishingSetInfo = {
  id: number
  name: string
  icon: string
  outdoor?: boolean
  /** Furnishing id and how many the set needs. */
  units: number[][]
  companions: { character: string; event: number }[]
}
export type FurnishingInfo = {
  name: string
  rarity: number
  icon?: string
  source?: string[]
  recipe?: Record<string, number>
}

type Table = {
  furnishingSets: FurnishingSetInfo[]
  furnishings: Record<string, FurnishingInfo>
  companionPrimogems: number
}

const table: Table = data

export const FURNISHING_SETS = table.furnishingSets
export const COMPANION_PRIMOGEMS = table.companionPrimogems
export const COMPANION_TOTAL = FURNISHING_SETS.reduce((sum, s) => sum + s.companions.length, 0)

export function furnishingInfo(id: number): FurnishingInfo | undefined {
  return table.furnishings[id]
}

/** How a furnishing is come by: made from a learned blueprint, from one not learned, or bought. */
export type Getting = "craft" | "blueprint" | "buy"
export type CompanionStatus = "claimable" | "claimed" | "notOwned"

export type UnitRow = {
  id: number
  info: FurnishingInfo
  need: number
  getting: Getting
  /** In the bag and still lacking; undefined without the bag's counts. */
  have?: number
  short?: number
}

export type SetRow = {
  info: FurnishingSetInfo
  learned: boolean
  units: UnitRow[]
  /** Kinds and pieces lacking, and the kinds lacking by how they are come by; bag only. */
  short?: { kinds: number; pieces: number; buy: number; blueprint: number }
  companions: { character: string; event: number; status: CompanionStatus }[]
  claimable: number
  /** What making the lacking pieces costs (the whole set's without the bag), with the bag's. */
  materials: { key: string; need: number; have: number }[]
}

export type FurnishingView = {
  rows: SetRow[]
  learned: number
  /** Sets the bag holds whole, and sets whose lacking pieces can all be made; bag only. */
  whole?: number
  craftable?: number
  claimed: number
  claimable: number
  /** The bag's furnishing counts were read. */
  bag: boolean
}

export function furnishingView(account: Account): FurnishingView {
  const c = account.collections
  const learnedSets = c?.furnishingSets ?? new Set<number>()
  const blueprints = c?.blueprintIds ?? new Set<number>()
  const collected = c?.companionRewards ?? new Set<number>()
  const owned = new Set(account.characters.map(ch => ch.key))
  const bag = account.furnishings
  const rows = FURNISHING_SETS.map(info => {
    const units = info.units.flatMap(([id = 0, need = 0]): UnitRow[] => {
      const unit = furnishingInfo(id)
      if (!unit) return []
      const getting: Getting = !unit.recipe ? "buy" : blueprints.has(id) ? "craft" : "blueprint"
      if (!bag) return [{ id, info: unit, need, getting }]
      const have = bag.get(id) ?? 0
      return [{ id, info: unit, need, getting, have, short: Math.max(0, need - have) }]
    })
    const lacking = units.filter(u => (u.short ?? u.need) > 0)
    const companions = info.companions.map(({ character, event }) => ({
      character,
      event,
      status: (collected.has(event)
        ? "claimed"
        : owned.has(character)
          ? "claimable"
          : "notOwned") as CompanionStatus,
    }))
    return {
      info,
      learned: learnedSets.has(info.id),
      units,
      short: bag && {
        kinds: lacking.length,
        pieces: lacking.reduce((sum, u) => sum + (u.short ?? 0), 0),
        buy: lacking.filter(u => u.getting === "buy").length,
        blueprint: lacking.filter(u => u.getting === "blueprint").length,
      },
      companions,
      claimable: companions.filter(x => x.status === "claimable").length,
      materials: makingCost(lacking, account.materials),
    }
  })
  return {
    rows,
    learned: rows.filter(r => r.learned).length,
    whole: bag && rows.filter(r => r.short?.kinds === 0).length,
    craftable: bag && rows.filter(r => r.short && r.short.kinds > 0 && lackingCraftable(r)).length,
    claimed: rows.reduce(
      (sum, r) => sum + r.companions.filter(x => x.status === "claimed").length,
      0,
    ),
    claimable: rows.reduce((sum, r) => sum + r.claimable, 0),
    bag: bag !== undefined,
  }
}

function lackingCraftable(row: SetRow) {
  return row.short?.buy === 0 && row.short.blueprint === 0
}

/**
 * The materials the units' lacking pieces cost to make (each unit's need without the bag), of
 * those whose blueprint is learned.
 */
function makingCost(units: UnitRow[], bag: Map<string, number>) {
  const need = new Map<string, number>()
  for (const unit of units) {
    if (unit.getting !== "craft" || !unit.info.recipe) continue
    const pieces = unit.short ?? unit.need
    for (const [key, count] of Object.entries(unit.info.recipe)) {
      need.set(key, (need.get(key) ?? 0) + count * pieces)
    }
  }
  return [...need].map(([key, count]) => ({ key, need: count, have: bag.get(key) ?? 0 }))
}

/** A furnishing the sets with rewards left need, with the names of those sets. */
export type NeedRow = UnitRow & { sets: string[] }

/**
 * The furnishings the sets with a reward left to claim need: each furnishing as many as the set
 * needing most of it, since a set's pieces can be taken down for the next once its rewards are
 * claimed; the lacking first, most lacking first. With the bag's counts, how many kinds it lacks.
 */
export function claimNeed(view: FurnishingView) {
  const need = new Map<number, NeedRow>()
  for (const row of view.rows) {
    if (row.claimable === 0) continue
    for (const unit of row.units) {
      const held = need.get(unit.id)
      const most = Math.max(held?.need ?? 0, unit.need)
      need.set(unit.id, {
        ...unit,
        need: most,
        ...(unit.have === undefined ? {} : { short: Math.max(0, most - unit.have) }),
        sets: [...(held?.sets ?? []), row.info.name],
      })
    }
  }
  const items = [...need.values()].sort((a, b) => (b.short ?? 0) - (a.short ?? 0) || a.id - b.id)
  return {
    items,
    lacking: view.bag ? items.filter(u => (u.short ?? 0) > 0).length : undefined,
  }
}

/**
 * Each character with a reward left to claim (owned, not claimed), with the sets it is for in
 * the game's order; those with the most first.
 */
export function byCharacter(rows: SetRow[]) {
  const characters = new Map<string, SetRow[]>()
  for (const set of rows) {
    for (const companion of set.companions) {
      if (companion.status !== "claimable") continue
      characters.set(companion.character, [...(characters.get(companion.character) ?? []), set])
    }
  }
  return [...characters]
    .map(([character, sets]) => ({ character, sets }))
    .sort((a, b) => b.sets.length - a.sets.length)
}
