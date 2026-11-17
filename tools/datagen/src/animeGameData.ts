// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { download } from "./download.ts"
import { list, num, record } from "./tables.ts"

type Pin = { repo: string; commit: string }
/**
 * From the character's profile: the title under the name, what the Vision is called (a few
 * carry something else, such as a Gnosis) and the constellation's name.
 */
export type Profile = { title: string; vision: string; constellation: string }
/** Game text by text hash. The dump leaves out empty texts, so a hash it lacks reads as empty. */
export type Text = (hash: unknown) => string

/** The language of the game text written out. GOOD keys come from the English text. */
export const LANGUAGE = "CHS"
/** AnimeGameData's avatar ids of the twins. */
export const TWINS = [10000005, 10000007]
export const MANEKINS: Record<string, number> = { Manekin: 10000117, Manekina: 10000118 }
/**
 * FetterInfo's fields for what the Vision is called before and after a story reveals more. Their
 * names are obfuscated and change between game versions; when they are gone, the new ones are the
 * two fields that give Neuvillette (10000087) a name each.
 */
const LOCKED = "BAJACJHKNEG"
const UNLOCKED = "KLNLFBBEFCA"

/** The maps are tens of MB, so a run reads each language once and passes the lookup around. */
export async function textMap({ repo, commit }: Pin, language: string): Promise<Text> {
  // The game splits its text between two maps; each hash is in one.
  const paths = [`TextMap/TextMap${language}.json`, `TextMap/TextMap_Medium${language}.json`]
  const maps = await Promise.all(
    paths.map(async path => record(JSON.parse(await download(repo, commit, path)), path)),
  )
  return hash => {
    if (typeof hash !== "number") throw new Error(`text hash ${hash} is not a number`)
    for (const map of maps) {
      const text = map[hash]
      // The game writes line breaks as a backslash and n.
      if (typeof text === "string") return text.replaceAll("\\n", "\n")
    }
    return ""
  }
}

/** Every character's profile by avatar id; `visions` are Vision names that win over the game's. */
export async function buildProfiles(
  { repo, commit }: Pin,
  text: Text,
  visions: Map<number, string>,
) {
  const load = async (name: string) =>
    list(JSON.parse(await download(repo, commit, `ExcelBinOutput/${name}`)), name)
  const [fetters, labels] = await Promise.all([
    load("FetterInfoExcelConfigData.json"),
    load("ManualTextMapConfigData.json"),
  ])
  const label = (id: string) => {
    const row = labels.find(row => row.textMapId === id)
    if (!row) throw new Error(`no UI text ${id}`)
    return text(row.textMapContentTextMapHash)
  }
  const vision = label("UI_STC_FETTER_VISION_BEFORE")
  const gnosis = label("UI_STC_FETTER_VISION_AFTER")
  const profiles = new Map<number, Profile>()
  for (const row of fetters) {
    if (!(LOCKED in row && UNLOCKED in row)) throw new Error("FetterInfo's Vision names moved")
    // The locked name is what the profile shows until a story reveals more, as the star wedge of
    // some Snezhnayans. Without either name the game's label applies, the one for after a reveal
    // when the character has a Vision text for after one, as the Archons do.
    const fallback = text(row.avatarVisionAfterTextMapHash) === "" ? vision : gnosis
    const id = num(row, "avatarId")
    profiles.set(id, {
      title: text(row.avatarTitleTextMapHash),
      vision: visions.get(id) || text(row[LOCKED]) || text(row[UNLOCKED]) || fallback,
      constellation: text(row.avatarConstellationBeforTextMapHash),
    })
  }
  return profiles
}

/** The profile of a Traveler or a Manekin. Exports do not say which twin the Traveler is, so the
 * twins' must agree. */
export function manualProfile(key: string, profiles: Map<number, Profile>): Profile {
  const ids = key.startsWith("Traveler") ? TWINS : [MANEKINS[key]]
  const [profile, ...others] = ids.map(id => profiles.get(id))
  if (!profile) throw new Error(`no profile for ${key}`)
  for (const other of others) {
    if (JSON.stringify(other) !== JSON.stringify(profile)) {
      throw new Error(`the twins' profiles differ: ${JSON.stringify([profile, other])}`)
    }
  }
  return profile
}
