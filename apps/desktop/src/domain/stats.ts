// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Character panel stats computed from game data, since exports do not
 * carry them: the character's base stats and ascension stat, the weapon's
 * base ATK and substat, artifact main stats and substats, and the stats of
 * active 2-piece set bonuses. Weapon passives, talents, constellations and
 * 4-piece effects are left out. Values are in GOOD's units (percent for keys
 * ending in _) and unrounded; formatStat rounds them as the game does.
 */

import data from "@/generated/builds.json"
import { mainStatValue } from "./builds"
import type { Artifact, Character, Weapon } from "./good"

/** `base` times the curve's value at the level, plus the amount for the ascension phase. */
type Grow = { base: number; curve: number | string; ascension?: readonly number[] }
type Curves = Record<string, readonly number[]>

type Table = {
  characterStats: Record<
    string,
    { hp: Grow; atk: Grow; def: Grow; stat: { key: string; ascension: readonly number[] } }
  >
  characterCurves: Curves
  weaponStats: Record<string, { atk: Grow; sub?: Grow & { key: string } }>
  weaponCurves: Curves
  setBonuses: Record<string, Record<string, number>>
}

const table: Table = data

/** HP, ATK and DEF: each a base, and a total that adds percentages of the base and flat amounts. */
export const BASE_STATS = ["hp", "atk", "def"] as const
export type BaseStatKey = (typeof BASE_STATS)[number]
export type BaseStat = { base: number; total: number }

/** The other stats, in the order the panel lists them. */
export const OTHER_STATS = [
  "eleMas",
  "critRate_",
  "critDMG_",
  "enerRech_",
  "heal_",
  "pyro_dmg_",
  "hydro_dmg_",
  "anemo_dmg_",
  "electro_dmg_",
  "dendro_dmg_",
  "cryo_dmg_",
  "geo_dmg_",
  "physical_dmg_",
] as const
export type OtherStatKey = (typeof OTHER_STATS)[number]

/** What every character starts with. */
const STARTING: Record<OtherStatKey, number> = {
  eleMas: 0,
  critRate_: 5,
  critDMG_: 50,
  enerRech_: 100,
  heal_: 0,
  pyro_dmg_: 0,
  hydro_dmg_: 0,
  anemo_dmg_: 0,
  electro_dmg_: 0,
  dendro_dmg_: 0,
  cryo_dmg_: 0,
  geo_dmg_: 0,
  physical_dmg_: 0,
}

export type CharacterStats = Record<BaseStatKey, BaseStat> & Record<OtherStatKey, number>

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), high)
}

function grown(grow: Grow, curves: Curves, level: number, ascension: number) {
  const curve = curves[String(grow.curve)] ?? []
  const phases = grow.ascension ?? []
  const factor = curve[clamp(level, 1, curve.length) - 1] ?? 0
  return grow.base * factor + (phases[clamp(ascension, 0, phases.length - 1)] ?? 0)
}

export type WeaponStats = { atk: number; sub?: { key: string; value: number } }

/** A weapon's base ATK at its level and ascension and its substat at its level. */
export function weaponStats(weapon: Weapon): WeaponStats | undefined {
  const entry = Object.hasOwn(table.weaponStats, weapon.key)
    ? table.weaponStats[weapon.key]
    : undefined
  if (!entry) return undefined
  const { level, ascension } = weapon
  const sub = entry.sub
  return {
    atk: grown(entry.atk, table.weaponCurves, level, ascension),
    sub: sub && { key: sub.key, value: grown(sub, table.weaponCurves, level, ascension) },
  }
}

/**
 * The panel stats of a character with its weapon and artifacts. None for
 * characters the data has no numbers for: the Manekins and keys newer than
 * the bundled data. A weapon or set the data lacks adds nothing.
 */
export function characterStats(
  character: Character,
  weapon: Weapon | undefined,
  artifacts: readonly Artifact[],
): CharacterStats | undefined {
  const own = Object.hasOwn(table.characterStats, character.key)
    ? table.characterStats[character.key]
    : undefined
  if (!own) return undefined
  const sums = new Map<string, number>()
  const add = (key: string, value: number) => sums.set(key, (sums.get(key) ?? 0) + value)
  const sum = (key: string) => sums.get(key) ?? 0

  const { level, ascension } = character
  const phases = own.stat.ascension
  add(own.stat.key, phases[clamp(ascension, 0, phases.length - 1)] ?? 0)
  const gear = weapon && weaponStats(weapon)
  if (gear?.sub) add(gear.sub.key, gear.sub.value)
  const pieces = new Map<string, number>()
  for (const artifact of artifacts) {
    const { mainStatKey, rarity } = artifact
    add(mainStatKey, mainStatValue(rarity, mainStatKey, artifact.level) ?? 0)
    for (const substat of artifact.substats) add(substat.key, substat.value)
    pieces.set(artifact.setKey, (pieces.get(artifact.setKey) ?? 0) + 1)
  }
  for (const [setKey, count] of pieces) {
    const bonus = Object.hasOwn(table.setBonuses, setKey) ? table.setBonuses[setKey] : undefined
    if (count >= 2) for (const [key, value] of Object.entries(bonus ?? {})) add(key, value)
  }

  const split = (key: BaseStatKey, base: number): BaseStat => ({
    base,
    total: base * (1 + sum(`${key}_`) / 100) + sum(key),
  })
  const curves = table.characterCurves
  const other = { ...STARTING }
  for (const key of OTHER_STATS) other[key] += sum(key)
  return {
    hp: split("hp", grown(own.hp, curves, level, ascension)),
    atk: split("atk", grown(own.atk, curves, level, ascension) + (gear?.atk ?? 0)),
    def: split("def", grown(own.def, curves, level, ascension)),
    ...other,
  }
}
