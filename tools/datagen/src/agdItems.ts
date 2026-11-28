// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { MANEKINS, manualProfile, type Profile, type Text, TWINS } from "./animeGameData.ts"
import { download } from "./download.ts"
import { translations, unusedItem } from "./manual.ts"
import {
  type ArtifactSet,
  type Character,
  type Constellation,
  type GameMaterial,
  list,
  num,
  type PassiveTalent,
  passive,
  plain,
  type Raw,
  type Row,
  str,
  type Talent,
  type Weapon,
} from "./tables.ts"

type Pin = { repo: string; commit: string }

/**
 * AnimeGameData's tables by file name; its text in the language written out; its Chinese text,
 * which decides what is written, so that every language has the same entries; its English text,
 * which gives GOOD keys; and manual.ts's Chinese text in the language written out.
 */
export type Game = {
  table: (name: string) => Promise<Raw[]>
  text: Text
  chs: Text
  english: Text
  manual: (chinese: string) => string
}

/** The game in Chinese. */
export function game({ repo, commit }: Pin, chs: Text, english: Text): Game {
  const cache = new Map<string, Promise<Raw[]>>()
  const table = (name: string) => {
    let rows = cache.get(name)
    if (!rows) {
      rows = download(repo, commit, `ExcelBinOutput/${name}`).then(json =>
        list(JSON.parse(json), name),
      )
      cache.set(name, rows)
    }
    return rows
  }
  return { table, text: chs, chs, english, manual: chinese => chinese }
}

/** `g` in English, sharing its tables. */
export function inEnglish(g: Game): Game {
  const manual = (chinese: string) => {
    const text = translations[chinese]
    if (!text) throw new Error(`no English for "${chinese}" in manual.ts`)
    return text
  }
  return { ...g, text: g.english, manual }
}

/** The ids the game's archive lists in `field` of `name`: the items released so far. */
async function archived({ table }: Game, name: string, field: string) {
  return new Set((await table(name)).map(row => row[field]))
}

/** The game's own weapon type names, by the keys the app uses. */
const WEAPON_TYPES: Record<string, string> = {
  WEAPON_SWORD_ONE_HAND: "sword",
  WEAPON_CATALYST: "catalyst",
  WEAPON_CLAYMORE: "claymore",
  WEAPON_BOW: "bow",
  WEAPON_POLE: "polearm",
}

/** Equip affix rows, an effect's levels or a passive's refinements, by their shared id. */
export async function affixes({ table }: Game) {
  const byId = new Map<number, Raw[]>()
  for (const row of await table("EquipAffixExcelConfigData.json")) {
    const id = num(row, "id")
    byId.set(id, [...(byId.get(id) ?? []), row])
  }
  // AnimeGameData leaves out level 0.
  for (const rows of byId.values()) rows.sort((a, b) => Number(a.level ?? 0) - Number(b.level ?? 0))
  return byId
}

/** Artifact sets by set id: the name and each effect come from the set's equip affix. */
export async function sets(g: Game): Promise<Row<ArtifactSet>[]> {
  const effects = await affixes(g)
  const released = await archived(g, "ReliquaryCodexExcelConfigData.json", "suitId")
  return (await g.table("ReliquarySetExcelConfigData.json")).flatMap(row => {
    if (!released.has(row.setId)) return []
    const levels = effects.get(Number(row.equipAffixId)) ?? []
    const needs = Array.isArray(row.setNeedNum) ? row.setNeedNum.map(Number) : []
    const first = levels[0]
    if (!first || levels.length !== needs.length) {
      throw new Error(`effects do not match piece counts on set ${row.setId}`)
    }
    const entry = {
      name: g.text(first.nameTextMapHash),
      icon: str(row, "setIcon"),
      effects: levels.map((level, i) => ({
        need: needs[i] ?? 0,
        text: plain(g.text(level.descTextMapHash)),
      })),
    }
    const hash = first.nameTextMapHash
    return [{ id: num(row, "setId"), en: g.english(hash), zh: g.chs(hash), entry }]
  })
}

/** Weapons by id; the passive's refinements come from the weapon's first skill affix. */
export async function weapons(g: Game): Promise<Row<Weapon>[]> {
  const effects = await affixes(g)
  const released = await archived(g, "WeaponCodexExcelConfigData.json", "weaponId")
  return (await g.table("WeaponExcelConfigData.json")).flatMap(row => {
    if (!released.has(row.id)) return []
    const type = WEAPON_TYPES[str(row, "weaponType")]
    if (!type) throw new Error(`unknown weapon type ${row.weaponType} on weapon ${row.id}`)
    const affix = Array.isArray(row.skillAffix) ? Number(row.skillAffix[0]) : 0
    const refinements = effects.get(affix) ?? []
    const first = refinements[0]
    const entry = {
      name: g.text(row.nameTextMapHash),
      rarity: num(row, "rankLevel"),
      type,
      icon: str(row, "icon"),
      flavor: plain(g.text(row.descTextMapHash)),
      passive: first
        ? passive({
            Name: g.text(first.nameTextMapHash),
            Descriptions: refinements.map((level, i) => ({
              Level: i,
              Description: g.text(level.descTextMapHash),
            })),
          })
        : undefined,
    }
    const hash = row.nameTextMapHash
    return [{ id: num(row, "id"), en: g.english(hash), zh: g.chs(hash), entry }]
  })
}

/** The game's element names, by what their energy costs are called. */
const ELEMENTS: Record<string, string> = {
  Fire: "pyro",
  Water: "hydro",
  Wind: "anemo",
  Electric: "electro",
  Grass: "dendro",
  Ice: "cryo",
  Rock: "geo",
}
/** Aloy's quality is special, and she is a 5-star. */
const RARITIES: Record<string, number> = {
  QUALITY_PURPLE: 4,
  QUALITY_ORANGE: 5,
  QUALITY_ORANGE_SP: 5,
}

/**
 * A skill set's element, which is what its elemental burst costs, its constellations, its three
 * talents and its passive talents.
 */
type SkillSet = {
  element?: string
  constellations: Constellation[]
  talents?: { auto: Talent; skill: Talent; burst: Talent }
  passives: PassiveTalent[]
}

async function avatarTables(g: Game) {
  const [avatars, depots, skills, constellations, proudSkills] = await Promise.all(
    [
      "AvatarExcelConfigData.json",
      "AvatarSkillDepotExcelConfigData.json",
      "AvatarSkillExcelConfigData.json",
      "AvatarTalentExcelConfigData.json",
      "ProudSkillExcelConfigData.json",
    ].map(g.table),
  )
  const byId = (rows: Raw[] = [], field = "id") => new Map(rows.map(row => [row[field], row]))
  const depotById = byId(depots)
  const skillById = byId(skills)
  const constellationById = byId(constellations, "talentId")
  // A passive talent's group has a row per level; the first is the one a character has.
  const passiveByGroup = byId(proudSkills?.toReversed(), "proudSkillGroupId")
  const described = (row: Raw, icon: string): Talent => ({
    name: g.text(row.nameTextMapHash),
    icon: str(row, icon),
    text: plain(g.text(row.descTextMapHash)),
  })
  const talent = (id: unknown) => {
    const row = skillById.get(id)
    return row && described(row, "skillIcon")
  }
  const skillSet = (id: unknown): SkillSet => {
    const depot = depotById.get(id)
    const list = (value: unknown) => (Array.isArray(value) ? value : [])
    const [auto, skill, burst] = [
      list(depot?.skills)[0],
      list(depot?.skills)[1],
      depot?.energySkill,
    ].map(talent)
    return {
      element: ELEMENTS[String(skillById.get(depot?.energySkill)?.costElemType)],
      constellations: list(depot?.talents).flatMap(id => {
        const row = constellationById.get(id)
        return row ? [described(row, "icon")] : []
      }),
      talents: auto && skill && burst ? { auto, skill, burst } : undefined,
      passives: list(depot?.inherentProudSkillOpens).flatMap(open => {
        const row = passiveByGroup.get(open.proudSkillGroupId)
        // Without an icon it is a placeholder, such as the Raiden Shogun's for cooking.
        if (typeof row?.icon !== "string") return []
        const ascension =
          typeof open.needAvatarPromoteLevel === "number" ? open.needAvatarPromoteLevel : 0
        return [{ ...described(row, "icon"), ascension }]
      }),
    }
  }
  return { avatars: byId(avatars), skillSet }
}

/**
 * Characters by avatar id. The archive has the Manekins, who have neither an element nor
 * constellations, but not the twins, who have a skill set for each element; `manualCharacters`
 * adds both.
 */
export async function characters(
  g: Game,
  profiles: Map<number, Profile>,
): Promise<Row<Character>[]> {
  const { avatars, skillSet } = await avatarTables(g)
  const released = await archived(g, "AvatarCodexExcelConfigData.json", "avatarId")
  return [...avatars.values()].flatMap(row => {
    const id = num(row, "id")
    if (!released.has(id) || Object.values(MANEKINS).includes(id)) return []
    const { element, constellations, talents, passives } = skillSet(row.skillDepotId)
    const weapon = WEAPON_TYPES[str(row, "weaponType")]
    const rarity = RARITIES[str(row, "qualityType")]
    if (!element || !weapon || !rarity || constellations.length !== 6 || !talents) {
      throw new Error(`avatar ${id} is incomplete`)
    }
    const entry = {
      name: g.text(row.nameTextMapHash),
      rarity,
      element,
      weapon,
      icon: str(row, "iconName"),
      constellations,
      talents,
      passives,
      profile: profiles.get(id),
    }
    const hash = row.nameTextMapHash
    return [{ id, en: g.english(hash), zh: g.chs(hash), entry }]
  })
}

/**
 * The characters `characters` leaves out, by GOOD key: the Traveler at each element, from the
 * twins' skill sets for it, and the Manekins.
 * Exports do not say which twin the Traveler is, so the twins' must agree, and the Travelers have
 * no icon.
 */
export async function manualCharacters(
  g: Game,
  profiles: Map<number, Profile>,
  travelerNames: Record<string, string>,
): Promise<Record<string, Character>> {
  const { avatars, skillSet } = await avatarTables(g)
  const avatar = (id: number) => {
    const row = avatars.get(id)
    const weapon = WEAPON_TYPES[String(row?.weaponType)]
    const rarity = RARITIES[String(row?.qualityType)]
    if (!row || !weapon || !rarity) throw new Error(`avatar ${id} is incomplete`)
    return { row, weapon, rarity }
  }
  const out: Record<string, Character> = {}
  for (const [key, id] of Object.entries(MANEKINS)) {
    const { row, weapon, rarity } = avatar(id)
    out[key] = {
      name: g.text(row.nameTextMapHash),
      rarity,
      weapon,
      icon: str(row, "iconName"),
      profile: manualProfile(key, profiles),
    }
  }
  const [twin, ...others] = TWINS.map(id => {
    const { row, weapon, rarity } = avatar(id)
    const sets = (Array.isArray(row.candSkillDepotIds) ? row.candSkillDepotIds : []).map(skillSet)
    return JSON.stringify({ weapon, rarity, sets: sets.filter(set => set.element) })
  })
  if (!twin || others.some(other => other !== twin)) throw new Error("the twins' skill sets differ")
  const { weapon, rarity, sets } = JSON.parse(twin) as {
    weapon: string
    rarity: number
    sets: Required<SkillSet>[]
  }
  for (const { element, constellations, talents, passives } of sets) {
    const key = `Traveler${element.charAt(0).toUpperCase()}${element.slice(1)}`
    const name = travelerNames[key]
    if (!name) throw new Error(`no name for ${key}`)
    if (constellations.length !== 6 || !talents) throw new Error(`${key} is incomplete`)
    out[key] = {
      name: g.manual(name),
      rarity,
      element,
      weapon,
      constellations,
      talents,
      passives,
      profile: manualProfile(key, profiles),
    }
  }
  const missing = Object.keys(travelerNames).filter(key => !(key in out))
  if (missing.length > 0) throw new Error(`no skill set for ${missing.join(", ")}`)
  return out
}

/**
 * Kinds of items kept in collections rather than the bag, so never in an export: card game cards,
 * name cards, outfits, wind gliders, the items that unlock a character and the like.
 */
const COLLECTED =
  /^MATERIAL_(GCG_\w+|NAMECARD|COSTUME|FLYCLOAK|PROFILE_FRAME|PHOTOGRAPH_POSE|AVATAR_TRACE|TPS_ACCESSORY|MUSIC_GAME_BOOK_THEME|AVATAR)$/

/**
 * Materials by id; test and retired items have no name, so they drop out. AnimeGameData leaves
 * out zeros and empty texts.
 */
export async function materials(g: Game): Promise<Row<GameMaterial>[]> {
  const rows = await g.table("MaterialExcelConfigData.json")
  return rows
    .filter(row => !COLLECTED.test(String(row.materialType)))
    .map(row => {
      const unused = unusedItem.test(g.chs(row.nameTextMapHash))
      const type = row.typeDescTextMapHash
      const typeText = (text: Text) => (type === undefined ? "" : text(type))
      const enType = typeText(g.english)
      const entry = {
        name: unused ? "" : g.text(row.nameTextMapHash),
        rarity: Number(row.rankLevel ?? 0),
        icon: typeof row.icon === "string" ? row.icon : "",
        typeName: typeText(g.text),
        zhType: typeText(g.chs),
        enType,
      }
      return {
        id: num(row, "id"),
        en: g.english(row.nameTextMapHash),
        zh: unused ? "" : g.chs(row.nameTextMapHash),
        entry,
        quest: enType === "Quest Item",
      }
    })
}
