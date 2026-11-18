// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Account } from "@/domain/account"
import { MATERIAL_TABS, type MaterialData, type MaterialTab, materialData } from "@/domain/names"
import { text } from "@/text/zh"

/** A material with what the name table says about it, as its card shows it. */
export type MaterialRow = MaterialData & {
  key: string
  count: number
  /** Since the previous snapshot; none with nothing to compare with. */
  change?: number
}

type Held = Pick<Account, "materials">

/**
 * Every material held, and those used up since the previous snapshot, shown
 * with 0: Leyline leaves out what is used up. An account without materials
 * lists none: against an older one, everything would look used up.
 */
export function materialRows(now: Held, previous: Held | null): MaterialRow[] {
  if (now.materials.size === 0) return []
  const keys = new Set(now.materials.keys())
  if (previous) for (const key of previous.materials.keys()) keys.add(key)
  const rows: MaterialRow[] = []
  for (const key of keys) {
    const count = now.materials.get(key) ?? 0
    const change = previous ? count - (previous.materials.get(key) ?? 0) : undefined
    if (count > 0 || (change !== undefined && change !== 0)) {
      rows.push({ key, ...materialData(key), count, change })
    }
  }
  return rows
}

const collator = new Intl.Collator("zh")
/** Sorts materials without a type after every type. */
const NO_TYPE = Number.MAX_SAFE_INTEGER

type Options = { onlyChanged: boolean; query: string }

/**
 * The rows the filters keep: a name containing the query and, with only
 * changed on, a count known to have moved.
 */
export function visibleRows(rows: readonly MaterialRow[], options: Options): MaterialRow[] {
  const query = options.query.trim().toLowerCase()
  return rows.filter(
    row =>
      (query === "" || row.name.toLowerCase().includes(query)) &&
      (!options.onlyChanged || Boolean(row.change)),
  )
}

/** How many of the rows each tab has. */
export function tabCounts(rows: readonly MaterialRow[]): Map<MaterialTab, number> {
  const counts = new Map<MaterialTab, number>(MATERIAL_TABS.map(tab => [tab, 0]))
  for (const row of rows) counts.set(row.tab, (counts.get(row.tab) ?? 0) + 1)
  return counts
}

/** A block of the page; only the currency tab's one block has no heading. */
export type MaterialGroup = { title?: string; rows: MaterialRow[] }

/**
 * A tab's rows by game type, in the order of the bundled data, materials
 * without a type last; rows in a group by rarity, highest first, then by
 * name. The currency tab has only a few kinds and shows them in one block,
 * in the same order.
 */
export function tabGroups(rows: readonly MaterialRow[], tab: MaterialTab): MaterialGroup[] {
  const byType = new Map<number, MaterialRow[]>()
  for (const row of rows) {
    if (row.tab !== tab) continue
    const order = row.typeOrder ?? NO_TYPE
    const group = byType.get(order)
    if (group) group.push(row)
    else byType.set(order, [row])
  }
  const groups = [...byType]
    .sort(([a], [b]) => a - b)
    .map(([, rows]) =>
      rows.sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0) || collator.compare(a.name, b.name)),
    )
  if (tab === "currency") return groups.length > 0 ? [{ rows: groups.flat() }] : []
  return groups.map(rows => ({ title: rows[0]?.type ?? text.materials.noType, rows }))
}

/** The first `count` rows across the groups in order, with the groups they fall in. */
export function takeRows(groups: readonly MaterialGroup[], count: number) {
  const taken: { group: MaterialGroup; rows: MaterialRow[] }[] = []
  let left = count
  for (const group of groups) {
    if (left <= 0) break
    taken.push({ group, rows: group.rows.slice(0, left) })
    left -= group.rows.length
  }
  return taken
}
