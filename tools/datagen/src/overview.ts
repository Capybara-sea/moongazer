// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Game } from "./agdItems.ts"
import { download } from "./download.ts"
import { list, num, plain, type Raw, str } from "./tables.ts"

type Pin = { repo: string; commit: string }
type Area = { total: number; city: number }
type Blessing = { name: string; text: string }
/** Elements by element key, characters by GOOD key. */
type Cast = { elements: string[]; guests: string[]; openers: string[] }
export type Overview = {
  profilePictures: Record<string, string>
  nameCards: Record<string, string>
  profileFrames: Record<string, string>
  theater: Record<string, number>
  theaterCasts: Record<string, Cast>
  stygian: Record<string, number>
  abyss: Record<string, number>
  abyssBlessings: Record<string, Blessing>
  areas: Record<string, Area>
  anecdotes: number
}

/** The game's element type ids, as the theater schedule lists them. */
const ELEMENT_IDS = new Map([
  [1, "pyro"],
  [2, "hydro"],
  [3, "dendro"],
  [4, "electro"],
  [5, "cryo"],
  [7, "anemo"],
  [8, "geo"],
])

/**
 * AnimeGameData's obfuscated field names change between game versions, so only plain field names
 * are read, and the anecdote table, which has no plain ones, is only counted. The theater's end
 * times and casts are in such fields, and AnimeGameData has no Stygian Onslaught seasons, so these
 * come from Snap.Metadata.
 */
export async function buildOverview(
  snap: Pin,
  g: Game,
  characters: Map<string, number>,
): Promise<Overview> {
  const load = async (path: string): Promise<Raw[]> =>
    list(JSON.parse(await download(snap.repo, snap.commit, path)), path)
  const [theater, stygian, pictures, abyss, entities, totals, cities, anecdotes, materials] =
    await Promise.all([
      load("Genshin/CHS/RoleCombatSchedule.json"),
      load("Genshin/CHS/HardChallengeSchedule.json"),
      ...[
        "ProfilePictureExcelConfigData.json",
        "TowerScheduleExcelConfigData.json",
        "DungeonLevelEntityConfigData.json",
        "ExploreAreaTotalExpExcelConfigData.json",
        "CityConfigData.json",
        "AnecdoteExcelConfigData.json",
        "MaterialExcelConfigData.json",
      ].map(g.table),
    ])
  return {
    profilePictures: Object.fromEntries(
      pictures.flatMap(row => (row.iconPath ? [[num(row, "id"), str(row, "iconPath")]] : [])),
    ),
    nameCards: nameCards(materials),
    profileFrames: profileFrames(materials),
    theater: times(theater, "End"),
    theaterCasts: casts(theater, characters),
    stygian: times(stygian, "End"),
    abyss: Object.fromEntries(abyss.map(row => [num(row, "scheduleId"), abyssOpens(row)])),
    abyssBlessings: blessings(g, abyss, entities),
    areas: areas(totals, cities),
    anecdotes: anecdotes.length,
  }
}

/** Unix seconds. Without a UTC offset Date.parse would read the time in the local zone. */
function times(rows: Raw[], field: string): Record<string, number> {
  return Object.fromEntries(
    rows.map(row => {
      const text = str(row, field)
      const ms = Date.parse(text)
      if (!/[+-]\d\d:\d\d$/.test(text) || Number.isNaN(ms)) {
        throw new Error(`${field} ${text} on ${row.Id} is not a time with a UTC offset`)
      }
      return [num(row, "Id"), ms / 1000]
    }),
  )
}

/** The wide art behind the player's name is the second picture. */
function nameCards(materials: Raw[]): Record<string, string> {
  const table: Record<string, string> = {}
  for (const row of materials) {
    if (row.materialType !== "MATERIAL_NAMECARD") continue
    const wide = Array.isArray(row.picPath) ? row.picPath[1] : undefined
    if (typeof wide !== "string" || !wide.startsWith("UI_NameCardPic_")) {
      throw new Error(`no wide art on name card ${row.id}`)
    }
    table[num(row, "id")] = wide
  }
  return table
}

/** A frame item unlocks a frame by id. The default frame, 100000, has no item, and no texture on the
 * icon hosts either, so it gets no frame, like an unknown id. */
function profileFrames(materials: Raw[]): Record<string, string> {
  const table: Record<string, string> = {}
  for (const row of materials) {
    if (row.materialType !== "MATERIAL_PROFILE_FRAME") continue
    const use = list(row.itemUse, "itemUse").find(
      use => use.useOp === "ITEM_USE_UNLOCK_PROFILE_FRAME",
    )
    const id = Array.isArray(use?.useParam) ? use.useParam[0] : undefined
    if (typeof id !== "string" || !/^\d+$/.test(id)) {
      throw new Error(`no frame id on frame item ${row.id}`)
    }
    table[id] = str(row, "icon")
  }
  return table
}

/**
 * When the first half of a Spiral Abyss season opens, in Unix seconds. The game's times are in its
 * servers' zone, UTC+8 for the Chinese servers.
 */
function abyssOpens(row: Raw): number {
  const [first] = list(row.schedules, "schedules")
  const text = first?.openTime
  const ms = typeof text === "string" ? Date.parse(`${text.replace(" ", "T")}+08:00`) : Number.NaN
  if (Number.isNaN(ms)) throw new Error(`no open time on abyss season ${row.scheduleId}`)
  return ms / 1000
}

/** A season's blessing has an effect for each level entity of the season's level config. */
function blessings(g: Game, seasons: Raw[], entities: Raw[]): Record<string, Blessing> {
  const effects = new Map<unknown, string[]>()
  for (const row of entities) {
    effects.set(row.id, [...(effects.get(row.id) ?? []), plain(g.text(row.descTextMapHash))])
  }
  const table: Record<string, Blessing> = {}
  for (const row of seasons) {
    const lines = effects.get(row.monthlyLevelConfigId)
    if (!lines) throw new Error(`no blessing effects for abyss season ${row.scheduleId}`)
    table[num(row, "scheduleId")] = {
      name: g.text(row.buffnameTextMapHash),
      text: lines.join("\n"),
    }
  }
  return table
}

/** Snap.Metadata lists characters by avatar id; `characters` gives the ids of names.json's keys. */
function casts(seasons: Raw[], characters: Map<string, number>): Record<string, Cast> {
  const ids = (row: Raw, field: string) => {
    const value = row[field]
    if (!Array.isArray(value) || !value.every(id => typeof id === "number")) {
      throw new Error(`${field} is not a list of ids on ${row.Id}`)
    }
    return value
  }
  const keys = new Map([...characters].map(([key, id]) => [id, key]))
  const key = (id: number) => {
    const found = keys.get(id)
    if (!found) throw new Error(`no GOOD key for avatar ${id}`)
    return found
  }
  return Object.fromEntries(
    seasons.map(row => [
      num(row, "Id"),
      {
        elements: ids(row, "Elements").map(id => {
          const element = ELEMENT_IDS.get(id)
          if (element === undefined) throw new Error(`unknown element ${id} on theater ${row.Id}`)
          return element
        }),
        guests: ids(row, "SpecialAvatars").map(key),
        openers: ids(row, "InitialAvatars").map(key),
      },
    ]),
  )
}

function areas(totals: Raw[], cities: Raw[]): Record<string, Area> {
  const owners = new Map<unknown, number[]>()
  for (const row of cities) {
    // The dump leaves out fields at their default value, such as an empty list.
    const ids = row.areaIdVec ?? []
    if (!Array.isArray(ids)) throw new Error(`areaIdVec is not an array on city ${row.cityId}`)
    for (const area of ids) owners.set(area, [...(owners.get(area) ?? []), num(row, "cityId")])
  }
  const table: Record<string, Area> = {}
  for (const row of totals) {
    const area = num(row, "areaID")
    const found = owners.get(area) ?? []
    const [city] = found
    if (city === undefined || found.length > 1) {
      throw new Error(`area ${area} is in ${found.length} cities, expected 1`)
    }
    table[area] = { total: num(row, "totalExp"), city }
  }
  return table
}
