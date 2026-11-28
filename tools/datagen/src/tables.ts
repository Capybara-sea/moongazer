// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Profile } from "./animeGameData.ts"
import { materialTabs } from "./manual.ts"

/** `text` is the effect. */
export type Constellation = { name: string; icon: string; text: string }
/** A talent's name, icon and description. */
export type Talent = { name: string; icon: string; text: string }
/** `ascension` is the phase that unlocks it, 0 for none. */
export type PassiveTalent = Talent & { ascension: number }
export type Character = {
  name: string
  rarity: number
  element?: string
  weapon: string
  icon?: string
  /** The first to the sixth; the Manekins have none. */
  constellations?: Constellation[]
  /** Normal attack, elemental skill and burst; the Manekins have none. */
  talents?: { auto: Talent; skill: Talent; burst: Talent }
  /** In the game's order. */
  passives?: PassiveTalent[]
  profile?: Profile
}
/**
 * A weapon passive's text for each refinement: the game highlights `values[refinement - 1]`
 * between the plain `parts`. One list of parts serves every refinement unless the wording itself
 * changes with it; then there is one per refinement.
 */
export type Passive = { name: string; parts: string[][]; values: string[][] }
export type Weapon = {
  name: string
  rarity: number
  type: string
  icon: string
  flavor: string
  /** The lowest-rarity weapons have none. */
  passive?: Passive
}
/** `need` is the piece count each effect takes. */
export type ArtifactSet = { name: string; icon: string; effects: { need: number; text: string }[] }
/**
 * A material as the game gives it, with the game's name for its type in the language written out,
 * in Chinese and in English.
 */
export type GameMaterial = {
  name: string
  rarity: number
  icon: string
  typeName: string
  zhType: string
  enType: string
}
/** `type` is an index into `materialTypes`; materials the game gives no type have none. */
export type Material = { name: string; rarity: number; icon: string; type?: number }
/**
 * `tab` is the materials page's tab for the type, a key of `materialTabs`; `id` is its Chinese
 * name in every language, which saved plans keep.
 */
export type MaterialType = { id: string; name: string; tab: string }
export type Tables = {
  characters: Record<string, Character>
  weapons: Record<string, Weapon>
  artifactSets: Record<string, ArtifactSet>
  materials: Record<string, Material>
  /** The game's own category names, such as weapon ascension material, in the materials page's
   * order. */
  materialTypes: MaterialType[]
}

export type Raw = Record<string, unknown>
/**
 * A game item with its English name, which gives the GOOD key, and its Chinese name, without which
 * it is left out. `quest` rows lose a shared key: players keep the material, not the quest item.
 */
export type Row<T> = { id: number; en: string; zh: string; entry: T; quest?: boolean }
/** The items of each kind, as AnimeGameData gives them. */
export type GameRows = {
  characters: Row<Character>[]
  weapons: Row<Weapon>[]
  artifactSets: Row<ArtifactSet>[]
  materials: Row<GameMaterial>[]
}
/** The id each GOOD key was taken from, for the kinds other output looks items up by. */
export type Ids = Record<"characters" | "weapons" | "artifactSets", Map<string, number>>

/** Genshin Optimizer's nameToKey; Teyvat.me Capture writes the same GOOD keys. */
export function goodKey(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join("")
}

/** The items of each kind by GOOD key. */
export function buildTables(rows: GameRows): { tables: Tables; ids: Ids } {
  const characters = toTable("characters", rows.characters)
  const weapons = toTable("weapons", rows.weapons)
  const artifactSets = toTable("artifact sets", rows.artifactSets)
  return {
    tables: {
      characters: characters.table,
      weapons: weapons.table,
      artifactSets: artifactSets.table,
      ...indexTypes(toTable("materials", rows.materials).table),
    },
    ids: { characters: characters.ids, weapons: weapons.ids, artifactSets: artifactSets.ids },
  }
}

type Place = { tab: string; rank: number }

const PLACES = Object.entries(materialTabs).flatMap(([tab, types]) =>
  types.map(type => ({ tab, type })),
)
const collator = new Intl.Collator("zh")

/** Where the materials page shows an English type name: listed ones by `materialTabs`, a region
 * not listed after the listed specialties, anything else last, under other. */
function place(enType: string): Place {
  const at = PLACES.findIndex(entry => entry.type === enType)
  const listed = PLACES[at]
  if (listed) return { tab: listed.tab, rank: at }
  if (enType.startsWith("Local Specialty (")) {
    return { tab: "specialty", rank: PLACES.findLastIndex(e => e.tab === "specialty") + 0.5 }
  }
  return { tab: "other", rank: PLACES.length }
}

/**
 * Swaps each material's type name for an index into one list, which keeps names.json small. The
 * list is in the materials page's order, ties by Chinese name. A Chinese type name may stand for
 * more than one English one; it goes where the first of them on the page does, by that one's name.
 */
function indexTypes(table: Record<string, GameMaterial>) {
  const places = new Map<string, Place & { name: string }>()
  for (const { typeName, zhType, enType } of Object.values(table)) {
    if (zhType === "") continue
    const found = place(enType)
    const kept = places.get(zhType)
    if (kept === undefined || found.rank < kept.rank)
      places.set(zhType, { ...found, name: typeName })
  }
  const order = [...places].sort(([a, pa], [b, pb]) => pa.rank - pb.rank || collator.compare(a, b))
  const materialTypes = order.map(([id, { name, tab }]) => ({ id, name, tab }))
  const index = new Map(order.map(([zhType], i) => [zhType, i]))
  const materials: Record<string, Material> = {}
  for (const [key, { name, rarity, icon, zhType }] of Object.entries(table)) {
    materials[key] = { name, rarity, icon, type: index.get(zhType) }
  }
  return { materials, materialTypes }
}

/** How the game highlights text in a passive, mostly the values that change with refinement. */
const HIGHLIGHT = /<color=#[0-9A-Fa-f]+>(.*?)<\/color>/
/**
 * Any other markup, such as links into the glossary; a leading # marks a text with placeholders,
 * of which talents use only the server's time zone.
 */
const MARKUP = /<[^>]*>|\{\/?LINK[^}]*\}|\{TIMEZONE\}|^#/g

/** Wording per input device, as {LAYOUT_PC#Press}; only the English text has it. */
const LAYOUT = /\{LAYOUT_(\w+)#([^}]*)\}/g

export function plain(text: string): string {
  return text
    .replace(LAYOUT, (_, device: string, words: string) => (device === "PC" ? words : ""))
    .replace(MARKUP, "")
}

export function passive(affix: Raw): Passive {
  const split = list(affix.Descriptions, "Descriptions").map((row, i) => {
    if (num(row, "Level") !== i) throw new Error(`passive texts out of order on ${affix.Name}`)
    // With a capture group, split puts each highlighted value between two plain pieces.
    const pieces = str(row, "Description").split(HIGHLIGHT).map(plain)
    return {
      parts: pieces.filter((_, at) => at % 2 === 0),
      values: pieces.filter((_, at) => at % 2 === 1),
    }
  })
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i])
  const first = split[0]?.parts ?? []
  return {
    name: str(affix, "Name"),
    parts: split.every(s => same(s.parts, first)) ? [first] : split.map(s => s.parts),
    values: split.map(s => s.values),
  }
}

/** Keys rows by GOOD key. Rows without a name in either language are dropped; on a shared key a
 * row that is not a quest item wins, then the lowest id. */
function toTable<T>(kind: string, rows: Row<T>[]) {
  const table: Record<string, T> = {}
  const ids = new Map<string, number>()
  const names = new Map<string, string>()
  let shared = 0
  let renamed = 0
  const byPreference = (a: Row<T>, b: Row<T>) =>
    Number(a.quest ?? false) - Number(b.quest ?? false) || a.id - b.id
  for (const row of rows.toSorted(byPreference)) {
    const key = goodKey(row.en)
    if (key === "" || row.zh === "") continue
    const kept = names.get(key)
    if (kept === undefined) {
      table[key] = row.entry
      ids.set(key, row.id)
      names.set(key, row.zh)
    } else {
      shared++
      if (kept !== row.zh) renamed++
    }
  }
  if (shared > 0) {
    console.log(
      `warning: ${kind}: dropped ${shared} entries whose key another row already has` +
        ` (${renamed} with a different Chinese name)`,
    )
  }
  return { table, ids }
}

export function str(raw: Raw, field: string): string {
  const value = raw[field]
  if (typeof value !== "string") {
    throw new Error(`${field} is not a string on ${raw.Id ?? raw.SetId ?? raw.id}`)
  }
  return value
}

export function num(raw: Raw, field: string): number {
  const value = raw[field]
  if (typeof value !== "number") {
    throw new Error(`${field} is not a number on ${raw.Id ?? raw.SetId ?? raw.id}`)
  }
  return value
}

export function record(value: unknown, what: string): Raw {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${what} is not an object`)
  }
  return value as Raw
}

export function list(value: unknown, what: string): Raw[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not an array`)
  return value.map(item => record(item, what))
}
