// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Game } from "./agdItems.ts"
import { download } from "./download.ts"
import { goodKey, list, num, plain, type Raw, str } from "./tables.ts"

type Pin = { repo: string; commit: string }

/** A gift set: one companions give primogems for. The other sets are left out. */
type FurnishingSet = {
  /** The suite id the game teaches the set by. */
  id: number
  name: string
  icon: string
  outdoor?: true
  /** Furnishing id and how many the set needs. */
  units: [number, number][]
  /** The characters whose reward for this set gives primogems, with the reward's event id. */
  companions: { character: string; event: number }[]
}
type Furnishing = {
  name: string
  rarity: number
  icon?: string
  /** Where the game says it comes from. */
  source?: string[]
  /** What making one costs, by material key. */
  recipe?: Record<string, number>
}
type Spincrystal = {
  id: number
  /** The GOOD key a crystal still in the bag goes by. */
  key: string
  /** The item's name, which numbers it. */
  label: string
  /** Missing where the game has not named the song yet. */
  song?: string
  area: number
  /** Where the game says to look. */
  hint?: string
}
export type Furnishings = {
  furnishingSets: FurnishingSet[]
  furnishings: Record<string, Furnishing>
  companionPrimogems: number
  spincrystals: Spincrystal[]
  spincrystalAreas: Record<string, string>
}

const PRIMOGEM = 201
const OUTDOOR = [771, 772]
/** Counts as of 7.2; fewer means a field moved or the format changed. */
const MINIMUM = { sets: 70, companions: 220, spincrystals: 200, hints: 200 }

/**
 * `characters` gives each playable character's GOOD key by id; `materials` holds the material
 * keys names.json has.
 */
export async function buildFurnishings(
  agd: Pin,
  g: Game,
  characters: Map<string, number>,
  materials: Set<string>,
): Promise<Furnishings> {
  const [suites, furniture, recipes, events, rewards, items, bgms, groups] = await Promise.all(
    [
      "FurnitureSuiteExcelConfigData.json",
      "HomeWorldFurnitureExcelConfigData.json",
      "FurnitureMakeExcelConfigData.json",
      "HomeWorldEventExcelConfigData.json",
      "RewardExcelConfigData.json",
      "MaterialExcelConfigData.json",
      "HomeWorldBgmExcelConfigData.json",
      "HomeWorldBgmGroupExcelConfigData.json",
    ].map(g.table),
  )
  const materialById = new Map(items.map(row => [num(row, "id"), row]))
  const materialKey = (id: number) => {
    const row = materialById.get(id)
    const key = row ? goodKey(g.english(row.nameTextMapHash)) : ""
    if (!materials.has(key)) throw new Error(`material ${id} has no key in names.json`)
    return key
  }
  const keyById = new Map([...characters].map(([key, id]) => [id, key]))
  const primogems = new Map<number, number>()
  for (const row of rewards) {
    for (const item of list(row.rewardItemList ?? [], "rewardItemList")) {
      if (item.itemId === PRIMOGEM) primogems.set(num(row, "rewardId"), num(item, "itemCount"))
    }
  }
  const paid = new Set<number>()
  const companionsOf = new Map<number, FurnishingSet["companions"]>()
  for (const row of events) {
    const amount = primogems.get(Number(row.rewardID))
    if (row.eventType !== "HOME_AVATAR_REWARD_EVENT" || !amount) continue
    paid.add(amount)
    const character = keyById.get(num(row, "avatarID"))
    if (!character) throw new Error(`companion ${row.avatarID} is not a character`)
    const suite = num(row, "furnitureSuitID")
    companionsOf.set(suite, [
      ...(companionsOf.get(suite) ?? []),
      { character, event: num(row, "eventID") },
    ])
  }
  if (paid.size !== 1) throw new Error(`companion rewards give ${[...paid].join(", ")} primogems`)

  const sets: FurnishingSet[] = []
  for (const row of [...suites].sort((a, b) => num(a, "suiteID") - num(b, "suiteID"))) {
    const id = num(row, "suiteID")
    const companions = companionsOf.get(id)
    if (!companions) continue
    const path = `BinOutput/HomeworldFurnitureSuit/${str(row, "jsonName")}.json`
    const json = await download(agd.repo, agd.commit, path)
    const counts = new Map<number, number>()
    for (const unit of list(JSON.parse(json).furnitureUnits, `furnitureUnits of suite ${id}`)) {
      const furnitureId = num(unit, "furnitureID")
      counts.set(furnitureId, (counts.get(furnitureId) ?? 0) + 1)
    }
    const type = Number((Array.isArray(row.furnType) ? row.furnType : [])[0] ?? 0)
    if (type === 0) throw new Error(`suite ${id} has no type`)
    sets.push({
      id,
      name: g.text(row.suiteNameTextMapHash),
      icon: str(row, "itemIcon"),
      ...(OUTDOOR.includes(type) ? { outdoor: true as const } : {}),
      units: [...counts].sort(([a], [b]) => a - b),
      companions,
    })
  }
  if (sets.length !== companionsOf.size) throw new Error("a companion reward names no suite")

  const recipeOf = new Map<number, Record<string, number>>()
  for (const row of recipes) {
    const recipe: Record<string, number> = {}
    for (const item of list(row.materialItems ?? [], "materialItems")) {
      if (item.id === undefined) continue
      const key = materialKey(num(item, "id"))
      recipe[key] = (recipe[key] ?? 0) + num(item, "count")
    }
    if (num(row, "count") !== 1) throw new Error(`furnishing recipe ${row.configID} makes several`)
    recipeOf.set(num(row, "furnitureItemID"), recipe)
  }
  const furnitureById = new Map(furniture.map(row => [num(row, "id"), row]))
  const furnishings: Record<string, Furnishing> = {}
  for (const set of sets) {
    for (const [id] of set.units) {
      const row = furnitureById.get(id)
      if (!row) throw new Error(`suite ${set.id} needs ${id}, not a furnishing`)
      const name = plain(g.text(row.nameTextMapHash))
      if (!name) throw new Error(`furnishing ${id} has no name`)
      const source = (Array.isArray(row.sourceTextList) ? row.sourceTextList : [])
        .map(hash => plain(g.text(hash)))
        .filter(Boolean)
      const icon = row.itemIcon
      const recipe = recipeOf.get(id)
      furnishings[id] = {
        name,
        rarity: num(row, "rankLevel"),
        ...(typeof icon === "string" && icon ? { icon } : {}),
        ...(source.length > 0 ? { source } : {}),
        ...(recipe ? { recipe } : {}),
      }
    }
  }

  const { spincrystals, spincrystalAreas } = crystals(g, items, bgms, groups)
  const counts = {
    sets: sets.length,
    companions: sets.reduce((sum, set) => sum + set.companions.length, 0),
    spincrystals: spincrystals.length,
    hints: spincrystals.filter(c => c.hint).length,
  }
  for (const [what, least] of Object.entries(MINIMUM)) {
    const found = counts[what as keyof typeof counts]
    if (found < least) throw new Error(`only ${found} ${what}, expected at least ${least}`)
  }
  const [companionPrimogems = 0] = paid
  return { furnishingSets: sets, furnishings, companionPrimogems, spincrystals, spincrystalAreas }
}

/**
 * The spincrystals: each unlocks a song of the realm's BGM table, in its group (an area). The
 * BGM and group tables have obfuscated field names, so the hint and the group's name are the one
 * field whose values are text on nearly every row.
 */
function crystals(g: Game, items: Raw[], bgms: Raw[], groups: Raw[]) {
  const bgmById = new Map(bgms.map(row => [num(row, "bgmID"), row]))
  const hintField = textField(g, bgms, ["bgmNameTextMapHash"], "BGM hint")
  const spincrystals: Spincrystal[] = []
  for (const row of items) {
    if (row.materialType !== "MATERIAL_BGM") continue
    const id = num(row, "id")
    const use = list(row.itemUse ?? [], `itemUse of ${id}`)[0]
    if (use?.useOp !== "ITEM_USE_UNLOCK_HOME_BGM")
      throw new Error(`spincrystal ${id} plays no song`)
    const param = Array.isArray(use.useParam) ? Number(use.useParam[0]) : NaN
    const song = bgmById.get(param)
    if (!song) throw new Error(`spincrystal ${id} names song ${param}, not in the BGM table`)
    const hint = plain(g.text(song[hintField]))
    const label = plain(g.text(row.nameTextMapHash))
    // The newest songs are named as their item until the game names them.
    const title = plain(g.text(song.bgmNameTextMapHash))
    spincrystals.push({
      id,
      key: goodKey(g.english(row.nameTextMapHash)),
      label,
      ...(title && title !== label ? { song: title } : {}),
      area: num(song, "cityId"),
      ...(hint ? { hint } : {}),
    })
  }
  spincrystals.sort((a, b) => a.id - b.id)
  const nameField = textField(g, groups, [], "BGM group name")
  const used = new Set(spincrystals.map(c => c.area))
  const spincrystalAreas = Object.fromEntries(
    groups
      .filter(row => used.has(num(row, "groupID")))
      .map(row => [num(row, "groupID"), plain(g.text(row[nameField]))]),
  )
  for (const c of spincrystals) {
    if (!spincrystalAreas[c.area])
      throw new Error(`spincrystal ${c.id} is in unknown area ${c.area}`)
  }
  return { spincrystals, spincrystalAreas }
}

/** The one field besides `known` whose numbers are text on at least four rows in five. */
function textField(g: Game, rows: Raw[], known: string[], what: string): string {
  const fields = new Set(rows.flatMap(row => Object.keys(row)))
  const found = [...fields].filter(field => {
    if (known.includes(field)) return false
    const texts = rows.filter(row => typeof row[field] === "number" && g.text(row[field]) !== "")
    return texts.length >= rows.length * 0.8
  })
  if (found.length !== 1) throw new Error(`no single field for the ${what}: ${found.join(", ")}`)
  return found[0] as string
}
