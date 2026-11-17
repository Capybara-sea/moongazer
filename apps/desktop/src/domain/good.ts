// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The GOOD part of an export: characters, weapons, artifacts and materials,
 * plus the Leyline per-character extras. Entries without a key are skipped; numbers
 * Leyline leaves out read as 0.
 */

import { count, list, ms, num, record, str } from "./json"

export type Talents = { auto: number; skill: number; burst: number }

export type Character = {
  key: string
  level: number
  ascension: number
  constellation: number
  /** Base levels, without the +3 of constellations 3 and 5. */
  talent: Talents
}

export type Weapon = {
  key: string
  level: number
  ascension: number
  refinement: number
  /** The wielder's key, "Traveler" for any Traveler, "" when unequipped. */
  location: string
  lock: boolean
}

export const SLOTS = ["flower", "plume", "sands", "goblet", "circlet"] as const
export type SlotKey = (typeof SLOTS)[number]

export type Substat = { key: string; value: number }

export type Artifact = {
  setKey: string
  slotKey: SlotKey
  level: number
  rarity: number
  mainStatKey: string
  location: string
  lock: boolean
  substats: Substat[]
  unactivatedSubstats: Substat[]
  /** Missing in GOOD files from exporters older than GOOD v3. */
  totalRolls?: number
  astralMark: boolean
  elixirCrafted: boolean
}

/** Leyline only: friendship and when the character joined. */
export type CharacterInfo = { friendship?: number; obtainedAt?: number }

function isSlot(value: unknown): value is SlotKey {
  return SLOTS.some(slot => slot === value)
}

function substats(value: unknown): Substat[] {
  return (list(value) ?? []).flatMap(item => {
    const key = str(record(item)?.key)
    const amount = num(record(item)?.value)
    // Exporters write empty slots as a blank key.
    return key && amount !== undefined ? [{ key, value: amount }] : []
  })
}

export function characters(value: unknown): Character[] {
  return (list(value) ?? []).flatMap(item => {
    const raw = record(item)
    const key = str(raw?.key)
    if (!raw || !key) return []
    const talent = record(raw.talent)
    return [
      {
        key,
        level: count(raw.level),
        ascension: count(raw.ascension),
        constellation: count(raw.constellation),
        talent: {
          auto: count(talent?.auto),
          skill: count(talent?.skill),
          burst: count(talent?.burst),
        },
      },
    ]
  })
}

export function weapons(value: unknown): Weapon[] {
  return (list(value) ?? []).flatMap(item => {
    const raw = record(item)
    const key = str(raw?.key)
    if (!raw || !key) return []
    return [
      {
        key,
        level: count(raw.level),
        ascension: count(raw.ascension),
        refinement: count(raw.refinement),
        location: str(raw.location) ?? "",
        lock: raw.lock === true,
      },
    ]
  })
}

export function artifacts(value: unknown): Artifact[] {
  return (list(value) ?? []).flatMap(item => {
    const raw = record(item)
    const setKey = str(raw?.setKey)
    const mainStatKey = str(raw?.mainStatKey)
    if (!raw || !setKey || !mainStatKey || !isSlot(raw.slotKey)) return []
    return [
      {
        setKey,
        slotKey: raw.slotKey,
        level: count(raw.level),
        rarity: count(raw.rarity),
        mainStatKey,
        location: str(raw.location) ?? "",
        lock: raw.lock === true,
        substats: substats(raw.substats),
        unactivatedSubstats: substats(raw.unactivatedSubstats),
        totalRolls: num(raw.totalRolls),
        astralMark: raw.astralMark === true,
        // Capture before 1.17.18 spelled it elixerCrafted.
        elixirCrafted: raw.elixirCrafted === true || raw.elixerCrafted === true,
      },
    ]
  })
}

/** Counts by material key; entries that are not numbers are skipped. */
export function materials(value: unknown) {
  const counts = new Map<string, number>()
  for (const [key, entry] of Object.entries(record(value) ?? {})) {
    const n = num(entry)
    if (n !== undefined) counts.set(key, n)
  }
  return counts
}

export function characterInfo(value: unknown) {
  const info = new Map<string, CharacterInfo>()
  for (const [key, entry] of Object.entries(record(value) ?? {})) {
    const raw = record(entry)
    if (raw) info.set(key, { friendship: num(raw.friendship), obtainedAt: ms(raw.obtainedAt) })
  }
  return info
}
