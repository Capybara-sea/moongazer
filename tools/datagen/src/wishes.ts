// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { download } from "./download.ts"
import type { Ids, Tables } from "./tables.ts"
import { list, num, str } from "./tables.ts"

type Pin = { repo: string; commit: string }

/** An event wish banner: its `type` is the API's `gacha_type` (301 and 400 are character events). */
export type Banner = {
  name: string
  version: string
  /** Which part of the version: 1 the first half, 2 the second; 1.3 had a third. */
  phase: number
  from: number
  to: number
  type: number
  up5: number[]
  up4: number[]
}

export type Wishes = {
  /** What a wish record's item id is: "c:<GOOD key>" or "w:<GOOD key>". */
  items: Record<string, string>
  banners: Banner[]
  /** The standard wish's five-stars, by item id. */
  standard: number[]
}

const TYPES = new Set([301, 302, 400, 500])

/**
 * Snap.Metadata's GachaEvent in `language` (its CHS or EN): every event banner since 1.0, with
 * its dates and featured items. `standard` is the standard wish's five-stars, by item id.
 */
export async function buildWishes(
  { repo, commit }: Pin,
  language: string,
  ids: Ids,
  standard: number[],
): Promise<Wishes> {
  const items: Record<string, string> = {}
  for (const [key, id] of ids.characters) items[id] = `c:${key}`
  for (const [key, id] of ids.weapons) items[id] = `w:${key}`
  const rows = list(
    JSON.parse(await download(repo, commit, `Genshin/${language}/GachaEvent.json`)),
    "GachaEvent",
  )
  const banners = rows.map(row => {
    const type = num(row, "Type")
    if (!TYPES.has(type)) throw new Error(`unknown banner type ${type} on ${row.Name}`)
    const from = Date.parse(str(row, "From"))
    const to = Date.parse(str(row, "To"))
    if (!(from < to)) throw new Error(`bad dates on banner ${row.Name}`)
    const featured = (field: string) => {
      const value = row[field]
      if (!Array.isArray(value)) throw new Error(`${field} is not an array on ${row.Name}`)
      return value.map(id => {
        if (typeof id !== "number" || !(id in items)) {
          throw new Error(`banner ${row.Name} features an unknown item ${String(id)}`)
        }
        return id
      })
    }
    return {
      name: str(row, "Name"),
      version: str(row, "Version"),
      phase: num(row, "Order"),
      from,
      to,
      type,
      up5: featured("UpOrangeList"),
      up4: featured("UpPurpleList"),
    }
  })
  banners.sort((a, b) => a.from - b.from || a.type - b.type)
  return { items, banners, standard }
}

/** The item ids of `names`, characters' and weapons' names in `tables`' language. */
export function standardIds(tables: Tables, ids: Ids, names: string[]): number[] {
  const byName = new Map<string, number>()
  for (const [key, id] of ids.characters) byName.set(tables.characters[key]?.name ?? "", id)
  for (const [key, id] of ids.weapons) byName.set(tables.weapons[key]?.name ?? "", id)
  return names.map(name => {
    const id = byName.get(name)
    if (id === undefined) throw new Error(`standard wish item ${name} is not in the game data`)
    return id
  })
}
