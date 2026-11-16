// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { download } from "./download.ts"

export type Character = {
  name: string
  rarity: number
  element?: string
  weapon: string
  icon?: string
}
export type Weapon = { name: string; rarity: number; type: string; icon: string }
export type ArtifactSet = { name: string; icon: string }
export type Material = { name: string; rarity: number; icon: string }
export type Tables = {
  characters: Record<string, Character>
  weapons: Record<string, Weapon>
  artifactSets: Record<string, ArtifactSet>
  materials: Record<string, Material>
}

type Raw = Record<string, unknown>
type Pair = { en: Raw; chs: Raw }
/** `quest` rows lose a shared key: players keep the material, not the quest item. */
type Row<T> = { id: number; en: string; entry: T; quest?: boolean }

const WEAPON_TYPES = new Map([
  [1, "sword"],
  [10, "catalyst"],
  [11, "claymore"],
  [12, "bow"],
  [13, "polearm"],
])
const ELEMENTS = ["pyro", "hydro", "anemo", "electro", "dendro", "cryo", "geo"]

/** Genshin Optimizer's nameToKey; Teyvat.me Capture writes the same GOOD keys. */
export function goodKey(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join("")
}

export async function buildTables(repo: string, commit: string): Promise<Tables> {
  const load = async (lang: string, path: string): Promise<unknown> =>
    JSON.parse(await download(repo, commit, `Genshin/${lang}/${path}`))
  const both = (path: string) => Promise.all([load("EN", path), load("CHS", path)])

  const joined = async (path: string, idField: string): Promise<Pair[]> => {
    const [en, chs] = await both(path)
    const chsById = new Map(list(chs, path).map(raw => [raw[idField], raw]))
    return list(en, path).flatMap(raw => {
      const match = chsById.get(raw[idField])
      return match ? [{ en: raw, chs: match }] : []
    })
  }
  const avatars = async (): Promise<Pair[]> => {
    const [enMeta, chsMeta] = await both("Meta.json")
    const ids = (meta: unknown) =>
      Object.keys(record(meta, "Meta.json"))
        .filter(name => name.startsWith("Avatar/"))
        .map(name => name.slice("Avatar/".length))
    const chsIds = new Set(ids(chsMeta))
    const pairs = ids(enMeta)
      .filter(id => chsIds.has(id))
      .map(async id => {
        const [en, chs] = await both(`Avatar/${id}.json`)
        return { en: record(en, id), chs: record(chs, id) }
      })
    return Promise.all(pairs)
  }

  const [characters, weapons, artifactSets, materials] = await Promise.all([
    avatars(),
    joined("Weapon.json", "Id"),
    joined("ReliquarySet.json", "SetId"),
    joined("Material.json", "Id"),
  ])
  return {
    characters: toTable("characters", characters.map(character)),
    weapons: toTable("weapons", weapons.map(weapon)),
    artifactSets: toTable("artifact sets", artifactSets.map(artifactSet)),
    materials: toTable("materials", materials.map(material)),
  }
}

function character({ en, chs }: Pair): Row<Character> {
  const element = str(record(en.FetterInfo, "FetterInfo"), "VisionBefore").toLowerCase()
  if (!ELEMENTS.includes(element)) throw new Error(`unknown element ${element} on avatar ${en.Id}`)
  const quality = num(en, "Quality")
  return {
    id: num(en, "Id"),
    en: str(en, "Name"),
    entry: {
      name: str(chs, "Name"),
      // Aloy's quality is 105, a special 5-star.
      rarity: quality === 105 ? 5 : quality,
      element,
      weapon: weaponType(en, "Weapon"),
      icon: str(en, "Icon"),
    },
  }
}

function weapon({ en, chs }: Pair): Row<Weapon> {
  return {
    id: num(en, "Id"),
    en: str(en, "Name"),
    entry: {
      name: str(chs, "Name"),
      rarity: num(en, "RankLevel"),
      type: weaponType(en, "WeaponType"),
      icon: str(en, "Icon"),
    },
  }
}

function artifactSet({ en, chs }: Pair): Row<ArtifactSet> {
  return {
    id: num(en, "SetId"),
    en: str(en, "Name"),
    entry: { name: str(chs, "Name"), icon: str(en, "Icon") },
  }
}

function material({ en, chs }: Pair): Row<Material> {
  return {
    id: num(en, "Id"),
    en: str(en, "Name"),
    entry: { name: str(chs, "Name"), rarity: num(en, "RankLevel"), icon: str(en, "Icon") },
    quest: en.TypeDescription === "Quest Item",
  }
}

/** Keys rows by GOOD key. Rows without a name in either language are dropped; on a shared key a
 * row that is not a quest item wins, then the lowest id. */
function toTable<T extends { name: string }>(kind: string, rows: Row<T>[]): Record<string, T> {
  const table: Record<string, T> = {}
  let shared = 0
  let renamed = 0
  const byPreference = (a: Row<T>, b: Row<T>) =>
    Number(a.quest ?? false) - Number(b.quest ?? false) || a.id - b.id
  for (const row of rows.toSorted(byPreference)) {
    const key = goodKey(row.en)
    if (key === "" || row.entry.name === "") continue
    const kept = table[key]
    if (kept === undefined) {
      table[key] = row.entry
    } else {
      shared++
      if (kept.name !== row.entry.name) renamed++
    }
  }
  if (shared > 0) {
    console.log(
      `warning: ${kind}: dropped ${shared} entries whose key another row already has` +
        ` (${renamed} with a different Chinese name)`,
    )
  }
  return table
}

function weaponType(raw: Raw, field: string): string {
  const type = WEAPON_TYPES.get(num(raw, field))
  if (type === undefined) throw new Error(`unknown weapon type ${raw[field]} on ${raw.Id}`)
  return type
}

function str(raw: Raw, field: string): string {
  const value = raw[field]
  if (typeof value !== "string") {
    throw new Error(`${field} is not a string on ${raw.Id ?? raw.SetId}`)
  }
  return value
}

function num(raw: Raw, field: string): number {
  const value = raw[field]
  if (typeof value !== "number") {
    throw new Error(`${field} is not a number on ${raw.Id ?? raw.SetId}`)
  }
  return value
}

function record(value: unknown, what: string): Raw {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${what} is not an object`)
  }
  return value as Raw
}

function list(value: unknown, what: string): Raw[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not an array`)
  return value.map(item => record(item, what))
}
