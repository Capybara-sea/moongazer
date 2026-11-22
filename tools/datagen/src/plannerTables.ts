// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** Readers of the game tables planner.ts builds from. */

import { list, num, type Raw } from "./tables.ts"

const MAX_LEVEL = 90

export function byId(rows: Raw[] = [], field: string) {
  return new Map(rows.map(row => [row[field], row]))
}

/** `some` alone skips the holes a sparse array has. */
export function hasGaps(values: unknown[]) {
  return [...values].some(value => value === undefined)
}

/** Promote rows by promote id, each id's rows by ascension phase. */
export function byPhase(rows: Raw[] = [], idField: string) {
  const table = new Map<unknown, Raw[]>()
  for (const row of rows) {
    const phases = table.get(row[idField]) ?? []
    phases[Number(row.promoteLevel ?? 0)] = row
    table.set(row[idField], phases)
  }
  for (const [id, phases] of table) if (hasGaps(phases)) throw new Error(`promote ${id} has gaps`)
  return table
}

/** The level caps every one of `all` shares, from phase 0. */
export function sameCaps(all: Iterable<Raw[]>, what: string): number[] {
  const found = new Set<string>()
  for (const phases of all) found.add(JSON.stringify(phases.map(row => num(row, "unlockMaxLevel"))))
  const [only] = found
  if (found.size !== 1 || only === undefined) throw new Error(`${what} have different level caps`)
  return JSON.parse(only) as number[]
}

/** EXP from each level to the next, levels 1 to 89. */
export function expList(rows: Raw[] = [], exp: (row: Raw) => number): number[] {
  const out: number[] = []
  for (const row of rows) {
    const level = num(row, "level")
    if (level < MAX_LEVEL) out[level - 1] = exp(row)
  }
  if (out.length !== MAX_LEVEL - 1 || hasGaps(out) || out.some(n => !(n > 0))) {
    throw new Error("level EXP has gaps")
  }
  return out
}

/** The items whose use is `op`, by GOOD key: the EXP each gives. */
export function expItems(rows: Raw[] = [], op: string, keyOf: (id: unknown) => string) {
  const items: Record<string, number> = {}
  for (const row of rows) {
    const use = list(row.itemUse ?? [], "itemUse").find(u => u.useOp === op)
    if (!use || !Array.isArray(use.useParam)) continue
    items[keyOf(row.id)] = Number(use.useParam[0])
  }
  if (Object.keys(items).length !== 3) throw new Error(`expected three ${op} items`)
  return items
}

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]

/**
 * Which pair of days each domain material of `needed` drops on, by the domains of each day. The
 * table's Saturday is under an obfuscated name, so Saturday is taken to be Wednesday's twin, as
 * Thursday and Friday are Monday's and Tuesday's.
 */
export function openDays(
  daily: Raw[] = [],
  dungeons: Map<unknown, Raw>,
  previews: Map<unknown, Raw>,
  keyOf: (id: unknown) => string,
  needed: Set<string>,
): Record<string, number> {
  const days = new Map<string, Set<number>>()
  for (const row of daily) {
    WEEKDAYS.forEach((field, day) => {
      for (const dungeonId of Array.isArray(row[field]) ? row[field] : []) {
        const preview = previews.get(dungeons.get(dungeonId)?.passRewardPreviewID)
        for (const item of list(preview?.previewItems ?? [], "previewItems")) {
          if (item.id === undefined) continue
          const key = keyOf(item.id)
          if (!needed.has(key)) continue
          days.set(key, (days.get(key) ?? new Set()).add(day))
        }
      }
    })
  }
  const out: Record<string, number> = {}
  for (const [key, found] of days) {
    // Such as Mora, which every domain gives.
    if (found.size === WEEKDAYS.length) continue
    const pair = JSON.stringify([...found].sort())
    const group = ["[0,3]", "[1,4]", "[2]"].indexOf(pair)
    if (group < 0) throw new Error(`${key} drops on weekdays ${pair}`)
    out[key] = group
  }
  return out
}
