// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Build data the character and artifact pages need, from the table `cargo
 * xtask gen-data` builds: which talents constellations raise, and artifact
 * main stat values. Also the level caps and icon names derived from GOOD data.
 */

import data from "@/generated/builds.json"
import names from "@/generated/names.json"
import { text } from "@/text/zh"
import type { Character, SlotKey, Talents } from "./good"

export type TalentKey = keyof Talents

const TALENT_KEYS: readonly TalentKey[] = ["auto", "skill", "burst"]

type Table = {
  talentBoosts: Record<string, string[]>
  mainStats: Record<string, Record<string, number[]>>
}

const table: Table = data

/** Level caps by ascension phase 0 to 6. */
const LEVEL_CAPS = [20, 40, 50, 60, 70, 80, 90]

export function levelCap(ascension: number) {
  return LEVEL_CAPS[Math.min(Math.max(ascension, 0), LEVEL_CAPS.length - 1)] ?? 90
}

/** The talents constellations 3 and 5 raise by three levels, in that order. */
export function talentBoosts(key: string): TalentKey[] {
  const boosts = table.talentBoosts[key] ?? []
  return TALENT_KEYS.filter(talent => boosts.includes(talent)).sort(
    (a, b) => boosts.indexOf(a) - boosts.indexOf(b),
  )
}

export type TalentLevel = { base: number; total: number; boosted: boolean }

/** Each talent's level with the +3 of the constellations reached; exports give the base. */
export function talentLevels(character: Character): Record<TalentKey, TalentLevel> {
  const [third, fifth] = talentBoosts(character.key)
  const boosted = (talent: TalentKey) =>
    (third === talent && character.constellation >= 3) ||
    (fifth === talent && character.constellation >= 5)
  const level = (talent: TalentKey): TalentLevel => {
    const base = character.talent[talent]
    const up = boosted(talent)
    return { base, total: up ? base + 3 : base, boosted: up }
  }
  return { auto: level("auto"), skill: level("skill"), burst: level("burst") }
}

/** An artifact's main stat value at its level, in GOOD's units (percent for keys ending in _). */
export function mainStatValue(rarity: number, key: string, level: number) {
  return table.mainStats[String(rarity)]?.[key]?.[level]
}

/** A stat's name by its GOOD key; the key itself when the app has no name for it. */
export function statName(key: string) {
  return text.game.stats[key] ?? key
}

/** "46.6%" for percentage stats (keys ending in _), "4,780" for flat ones. */
export function formatStat(key: string, value: number) {
  return key.endsWith("_") ? `${value.toFixed(1)}%` : Math.round(value).toLocaleString("en-US")
}

/** The number each slot's piece icon ends in, e.g. UI_RelicIcon_15001_4 for the flower. */
const SLOT_ICONS: Record<SlotKey, number> = { flower: 4, plume: 2, sands: 5, goblet: 1, circlet: 3 }

const sets: Record<string, { icon: string }> = names.artifactSets

/** A piece's icon, from its set's icon (UI_RelicIcon_<set id>_<slot>). */
export function artifactIcon(setKey: string, slot: SlotKey) {
  const id = (Object.hasOwn(sets, setKey) ? sets[setKey]?.icon : undefined)?.match(
    /^UI_RelicIcon_(\d+)_\d$/,
  )?.[1]
  return id === undefined ? undefined : `UI_RelicIcon_${id}_${SLOT_ICONS[slot]}`
}

/** Weapons and artifacts name any Traveler just "Traveler". */
export function wielderKey(characterKey: string) {
  return characterKey.startsWith("Traveler") ? "Traveler" : characterKey
}
