// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { affixes, type Game } from "./agdItems.ts"
import { TWINS } from "./animeGameData.ts"
import { type Ids, list, num, plain, type Raw, str } from "./tables.ts"

export type Talent = "auto" | "skill" | "burst"
/** `base` times the level curve `curve`, plus `ascension[phase]` when there is one. */
type Grow = { base: number; curve: string; ascension?: number[] }
type CharacterStats = { hp: Grow; atk: Grow; def: Grow; stat: { key: string; ascension: number[] } }
type WeaponStats = { atk: Grow; sub?: Grow & { key: string } }
/** Curve multipliers by curve name, one per level from 1. */
type Curves = Record<string, number[]>
export type Builds = {
  /** The talents constellations 3 and 5 raise by three levels, by GOOD key. */
  talentBoosts: Record<string, [Talent, Talent]>
  /** Artifact main stat values by rarity and GOOD stat key, one per level from +0, in GOOD's units. */
  mainStats: Record<string, Record<string, number[]>>
  /** Base HP, ATK and DEF and the ascension stat by GOOD key, in GOOD's units. */
  characterStats: Record<string, CharacterStats>
  characterCurves: Curves
  /** Base ATK and the substat by GOOD key, in GOOD's units. */
  weaponStats: Record<string, WeaponStats>
  weaponCurves: Curves
  /** The stats of each set's 2-piece bonus by GOOD keys, in GOOD's units. */
  setBonuses: Record<string, Record<string, number>>
}

/** The game's names for fight properties, to GOOD stat keys. */
const PROP_STATS = new Map([
  ["FIGHT_PROP_HP", "hp"],
  ["FIGHT_PROP_HP_PERCENT", "hp_"],
  ["FIGHT_PROP_ATTACK", "atk"],
  ["FIGHT_PROP_ATTACK_PERCENT", "atk_"],
  ["FIGHT_PROP_DEFENSE", "def"],
  ["FIGHT_PROP_DEFENSE_PERCENT", "def_"],
  ["FIGHT_PROP_CRITICAL", "critRate_"],
  ["FIGHT_PROP_CRITICAL_HURT", "critDMG_"],
  ["FIGHT_PROP_CHARGE_EFFICIENCY", "enerRech_"],
  ["FIGHT_PROP_HEAL_ADD", "heal_"],
  ["FIGHT_PROP_ELEMENT_MASTERY", "eleMas"],
  ["FIGHT_PROP_PHYSICAL_ADD_HURT", "physical_dmg_"],
  ["FIGHT_PROP_FIRE_ADD_HURT", "pyro_dmg_"],
  ["FIGHT_PROP_ELEC_ADD_HURT", "electro_dmg_"],
  ["FIGHT_PROP_WATER_ADD_HURT", "hydro_dmg_"],
  ["FIGHT_PROP_GRASS_ADD_HURT", "dendro_dmg_"],
  ["FIGHT_PROP_WIND_ADD_HURT", "anemo_dmg_"],
  ["FIGHT_PROP_ROCK_ADD_HURT", "geo_dmg_"],
  ["FIGHT_PROP_ICE_ADD_HURT", "cryo_dmg_"],
])
/** Set bonuses the stats panel does not show: elemental RES, incoming healing, shield strength. */
const UNSHOWN = /^FIGHT_PROP_(\w+_SUB_HURT|HEALED_ADD|SHIELD_COST_MINUS_RATIO)$/
const BASE_ATTACK = "FIGHT_PROP_BASE_ATTACK"

/**
 * The game's numbers by GOOD key, for the items of names.json, which `ids` gives the ids of.
 * AnimeGameData leaves out fields at their default value, such as zeros and phase 0's number.
 */
export async function buildBuilds(g: Game, ids: Ids): Promise<Builds> {
  const [
    avatars,
    depots,
    skills,
    talents,
    avatarPromotes,
    avatarCurves,
    weapons,
    weaponPromotes,
    weaponCurves,
    levels,
    sets,
  ] = await Promise.all(
    [
      "AvatarExcelConfigData.json",
      "AvatarSkillDepotExcelConfigData.json",
      "AvatarSkillExcelConfigData.json",
      "AvatarTalentExcelConfigData.json",
      "AvatarPromoteExcelConfigData.json",
      "AvatarCurveExcelConfigData.json",
      "WeaponExcelConfigData.json",
      "WeaponPromoteExcelConfigData.json",
      "WeaponCurveExcelConfigData.json",
      "ReliquaryLevelExcelConfigData.json",
      "ReliquarySetExcelConfigData.json",
    ].map(g.table),
  )
  const avatarById = byId(avatars, "id")
  const boosts = talentBoosts(g, byId(depots, "id"), byId(skills, "id"), byId(talents, "talentId"))
  const promotes = phases(avatarPromotes, "avatarPromoteId")
  const builds: Builds = {
    talentBoosts: {},
    mainStats: mainStats(levels),
    characterStats: {},
    characterCurves: curves(avatarCurves),
    weaponStats: {},
    weaponCurves: curves(weaponCurves),
    setBonuses: setBonuses(ids.artifactSets, sets, await affixes(g)),
  }
  for (const [key, id] of ids.characters) {
    const avatar = avatarById.get(id)
    if (!avatar) throw new Error(`no avatar ${id}`)
    const boost = boosts(avatar.skillDepotId)
    if (boost) builds.talentBoosts[key] = boost
    builds.characterStats[key] = characterStatsOf(avatar, promotes)
  }
  // Exports do not say which twin the Traveler is, so the twins must have the same stats, which
  // every element shares, and the same talent boosts for each element.
  const twins = TWINS.map(id => {
    const avatar = avatarById.get(id)
    if (!avatar) throw new Error(`no avatar ${id} in AnimeGameData`)
    return avatar
  })
  const [traveler, ...others] = twins.map(twin => JSON.stringify(characterStatsOf(twin, promotes)))
  if (!traveler || others.some(other => other !== traveler)) {
    throw new Error("the twins' stats differ")
  }
  const [travelerBoosts, ...otherBoosts] = twins.map(twin =>
    JSON.stringify(
      Object.fromEntries(travelerTalentBoosts(twin, byId(depots, "id"), skills, boosts)),
    ),
  )
  if (!travelerBoosts || otherBoosts.some(other => other !== travelerBoosts)) {
    throw new Error("the twins' talent boosts differ")
  }
  for (const [key, boost] of Object.entries(
    JSON.parse(travelerBoosts) as Record<string, [Talent, Talent]>,
  )) {
    builds.talentBoosts[key] = boost
    builds.characterStats[key] = JSON.parse(traveler) as CharacterStats
  }
  const weaponById = byId(weapons, "id")
  const weaponPhases = phases(weaponPromotes, "weaponPromoteId")
  for (const [key, id] of ids.weapons) {
    const weapon = weaponById.get(id)
    if (!weapon) throw new Error(`no weapon ${id}`)
    builds.weaponStats[key] = weaponStatsOf(weapon, weaponPhases)
  }
  return builds
}

function byId(rows: Raw[] = [], field: string) {
  return new Map(rows.map(row => [row[field], row]))
}

/** Percentages are fractions in the game and percent in GOOD. */
function inGoodUnits(key: string, value: number) {
  return key.endsWith("_") ? Math.round(value * 1e6) / 1e4 : value
}

/** An amount the dump leaves out is zero. */
function amount(prop: Raw) {
  return typeof prop.value === "number" ? prop.value : 0
}

/** Promote rows by promote id, each id's rows by ascension phase: fight property to amount. */
function phases(rows: Raw[] = [], idField: string): Map<unknown, Map<string, number>[]> {
  const table = new Map<unknown, Map<string, number>[]>()
  for (const row of rows) {
    const values = list(row.addProps, "addProps").flatMap((prop): [string, number][] =>
      typeof prop.propType === "string" ? [[prop.propType, amount(prop)]] : [],
    )
    const byPhase = table.get(row[idField]) ?? []
    byPhase[typeof row.promoteLevel === "number" ? row.promoteLevel : 0] = new Map(values)
    table.set(row[idField], byPhase)
  }
  return table
}

/** Characters ascend six times, most weapons too; the lowest-rarity ones only four times. */
function phasesOf(promotes: Map<unknown, Map<string, number>[]>, id: unknown, what: string) {
  const found = promotes.get(id) ?? []
  if (found.length === 0 || hasGaps(found)) throw new Error(`ascension phases missing on ${what}`)
  return found
}

/** Curves by name. */
function curves(rows: Raw[] = []): Curves {
  const table: Curves = {}
  for (const row of rows) {
    for (const curve of list(row.curveInfos, "curveInfos")) {
      const values = table[str(curve, "type")] ?? []
      values[num(row, "level") - 1] = num(curve, "value")
      table[str(curve, "type")] = values
    }
  }
  for (const [name, values] of Object.entries(table)) {
    if (values.length !== rows.length || hasGaps(values)) throw new Error(`curve ${name} has gaps`)
  }
  return table
}

/** `some` alone skips the holes a sparse array has. */
function hasGaps(values: unknown[]) {
  return [...values].some(value => value === undefined)
}

function characterStatsOf(
  avatar: Raw,
  promotes: Map<unknown, Map<string, number>[]>,
): CharacterStats {
  const found = phasesOf(promotes, avatar.avatarPromoteId, `avatar ${avatar.id}`)
  const grows = new Map(
    list(avatar.propGrowCurves, "propGrowCurves").map(g => [str(g, "type"), str(g, "growCurve")]),
  )
  const grow = (field: string, prop: string): Grow => {
    const curve = grows.get(prop)
    if (curve === undefined) throw new Error(`no curve for ${prop} on avatar ${avatar.id}`)
    return { base: num(avatar, field), curve, ascension: found.map(phase => phase.get(prop) ?? 0) }
  }
  const types = [...(found[0]?.keys() ?? [])].filter(type => !type.startsWith("FIGHT_PROP_BASE_"))
  const [type] = types
  const key = type === undefined ? undefined : PROP_STATS.get(type)
  if (type === undefined || key === undefined || types.length > 1) {
    throw new Error(`no one known ascension stat on avatar ${avatar.id}`)
  }
  return {
    hp: grow("hpBase", "FIGHT_PROP_BASE_HP"),
    atk: grow("attackBase", BASE_ATTACK),
    def: grow("defenseBase", "FIGHT_PROP_BASE_DEFENSE"),
    stat: { key, ascension: found.map(phase => inGoodUnits(key, phase.get(type) ?? 0)) },
  }
}

/** Ascension adds only to ATK. A weapon without a substat lists its curve alone. */
function weaponStatsOf(weapon: Raw, promotes: Map<unknown, Map<string, number>[]>): WeaponStats {
  const found = phasesOf(promotes, weapon.weaponPromoteId, `weapon ${weapon.id}`)
  const stats: WeaponStats = { atk: { base: 0, curve: "" } }
  for (const prop of list(weapon.weaponProp, "weaponProp")) {
    if (prop.propType === undefined) continue
    const type = str(prop, "propType")
    const curve = str(prop, "type")
    const base = typeof prop.initValue === "number" ? prop.initValue : 0
    if (type === BASE_ATTACK) {
      stats.atk = { base, curve, ascension: found.map(phase => phase.get(type) ?? 0) }
    } else {
      const key = PROP_STATS.get(type)
      if (!key) throw new Error(`unknown substat ${type} on weapon ${weapon.id}`)
      stats.sub = { key, base: inGoodUnits(key, base), curve }
    }
  }
  if (stats.atk.curve === "") throw new Error(`no base ATK on weapon ${weapon.id}`)
  return stats
}

/** A set's 2-piece bonus is its equip affix's level at the place of 2 among its piece counts. */
function setBonuses(ids: Map<string, number>, sets: Raw[] = [], effects: Map<number, Raw[]>) {
  const setById = byId(sets, "setId")
  const table: Builds["setBonuses"] = {}
  for (const [key, id] of ids) {
    const set = setById.get(id)
    const needs = Array.isArray(set?.setNeedNum) ? set.setNeedNum : []
    const affix = effects.get(Number(set?.equipAffixId))?.[needs.indexOf(2)]
    if (affix === undefined) continue
    const stats: Record<string, number> = {}
    for (const prop of list(affix.addProps, "addProps")) {
      const type = prop.propType
      if (type === undefined || (typeof type === "string" && UNSHOWN.test(type))) continue
      const stat = PROP_STATS.get(String(type))
      if (!stat) throw new Error(`unknown set bonus ${type} on set ${id}`)
      stats[stat] = (stats[stat] ?? 0) + inGoodUnits(stat, amount(prop))
    }
    if (Object.keys(stats).length > 0) table[key] = stats
  }
  return table
}

/**
 * The talents a skill set's constellations 3 and 5 raise, which their texts name; none when
 * neither names a talent, as for Aloy and the Manekins.
 */
function talentBoosts(
  g: Game,
  depots: Map<unknown, Raw>,
  skills: Map<unknown, Raw>,
  talents: Map<unknown, Raw>,
) {
  return (depotId: unknown): [Talent, Talent] | undefined => {
    const depot = depots.get(depotId)
    const ids = Array.isArray(depot?.skills) ? depot.skills : []
    const name = (id: unknown) => {
      const skill = skills.get(id)
      return skill ? g.chs(skill.nameTextMapHash) : ""
    }
    const named: [Talent, string][] = [
      ["auto", name(ids[0])],
      ["skill", name(ids[1])],
      ["burst", name(depot?.energySkill)],
    ]
    const constellations = Array.isArray(depot?.talents) ? depot.talents : []
    const [third, fifth] = [3, 5].map(n => {
      const talent = talents.get(constellations[n - 1])
      const text = talent ? plain(g.chs(talent.descTextMapHash)) : ""
      const found = named.filter(([, skill]) => skill !== "" && text.includes(skill))
      if (found.length > 1) throw new Error(`constellation ${n} of skill set ${depotId} is unclear`)
      return found[0]?.[0]
    })
    if (!third && !fifth) return undefined
    if (!third || !fifth) throw new Error(`only one talent boost on skill set ${depotId}`)
    return [third, fifth]
  }
}

/** A twin's talent boosts for each element by the Traveler's GOOD key. */
function travelerTalentBoosts(
  twin: Raw,
  depots: Map<unknown, Raw>,
  skills: Raw[] = [],
  boosts: (depotId: unknown) => [Talent, Talent] | undefined,
) {
  const elements = new Map(skills.map(skill => [skill.id, skill.costElemType]))
  const ids = Array.isArray(twin.candSkillDepotIds) ? twin.candSkillDepotIds : []
  return ids.flatMap((id): [string, [Talent, Talent]][] => {
    const element = TRAVELER_ELEMENTS[String(elements.get(depots.get(id)?.energySkill))]
    if (!element) return []
    const boost = boosts(id)
    if (!boost) throw new Error(`no talent boosts on the Traveler's skill set ${id}`)
    return [[`Traveler${element}`, boost]]
  })
}

/** GOOD's element names by what the game calls an elemental burst's energy. */
export const TRAVELER_ELEMENTS: Record<string, string> = {
  Fire: "Pyro",
  Water: "Hydro",
  Wind: "Anemo",
  Electric: "Electro",
  Grass: "Dendro",
  Ice: "Cryo",
  Rock: "Geo",
}

function mainStats(rows: Raw[] = []): Builds["mainStats"] {
  const table: Builds["mainStats"] = {}
  for (const row of rows) {
    // Rows without a rank hold unrelated properties.
    if (typeof row.rank !== "number") continue
    // Levels count from 1, at +0.
    const level = num(row, "level") - 1
    for (const prop of list(row.addProps, "addProps")) {
      const key = PROP_STATS.get(String(prop.propType))
      // No artifact has flat DEF as its main stat.
      if (!key || key === "def") continue
      const stats = table[row.rank] ?? {}
      const values = stats[key] ?? []
      values[level] = inGoodUnits(key, amount(prop))
      stats[key] = values
      table[row.rank] = stats
    }
  }
  for (const [rarity, stats] of Object.entries(table)) {
    for (const [key, values] of Object.entries(stats)) {
      if (hasGaps(values)) throw new Error(`${rarity}★ ${key} has gaps`)
    }
  }
  return table
}
