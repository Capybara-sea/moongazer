// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Account } from "@/domain/account"
import { formatStat, levelCap } from "@/domain/builds"
import type { Element } from "@/domain/elements"
import type { Character } from "@/domain/good"
import { BASE_STATS, type CharacterStats, OTHER_STATS, type OtherStatKey } from "@/domain/stats"
import { formatMonthDay } from "@/lib/format"
import { visibleCharacters } from "./order"

type ListOptions = Parameters<typeof visibleCharacters>[1]

/**
 * The characters the detail page steps through: the list's filter and sort,
 * or every character in the same sort when the filter hides the one shown,
 * so its position and its neighbors still mean something.
 */
export function detailOrder(characters: readonly Character[], options: ListOptions, key: string) {
  const visible = visibleCharacters(characters, options)
  return visible.some(c => c.key === key)
    ? visible
    : visibleCharacters(characters, { element: null, query: "", sort: options.sort })
}

export type Neighbors = { at: number; total: number; previous: string; next: string }

/** The key's place in the list (from 1) and the keys before and after it, wrapping around. */
export function neighbors(keys: readonly string[], key: string): Neighbors | undefined {
  const index = keys.indexOf(key)
  if (index < 0) return undefined
  const total = keys.length
  return {
    at: index + 1,
    total,
    previous: keys[(index - 1 + total) % total] ?? key,
    next: keys[(index + 1) % total] ?? key,
  }
}

/**
 * Whether the character has ascended for its level: at least once, and below the cap its phases
 * give. At the cap (including 90/90) there is nothing to tell apart, so no star.
 */
export function ascended(level: number, ascension: number) {
  return ascension > 0 && level < levelCap(ascension)
}

/** "2021-09-01" in local time. */
export function formatDate(ms: number) {
  return `${new Date(ms).getFullYear()}-${formatMonthDay(ms)}`
}

/**
 * The older account as usePreviousAccount gives it, or null when it lists no
 * characters: an export without them would show everyone as new.
 */
export function comparedAccount(previous: Account | null | undefined) {
  return previous?.characters.length === 0 ? null : previous
}

export type StatRow = { key: string; total: string; base?: string; bonus?: string }

const ALWAYS_SHOWN: readonly OtherStatKey[] = ["eleMas", "critRate_", "critDMG_", "enerRech_"]
const DMG_BONUSES = OTHER_STATS.filter(key => key.endsWith("_dmg_"))

/**
 * The stats card's rows: HP, ATK and DEF with base and bonus; Elemental
 * Mastery, CRIT and Energy Recharge; the DMG bonuses above zero, the
 * character's own element's always; Healing Bonus above zero.
 */
export function statRows(stats: CharacterStats, element: Element | undefined): StatRow[] {
  const own = element && `${element}_dmg_`
  const shown = [...ALWAYS_SHOWN, ...DMG_BONUSES.filter(key => key === own || stats[key] > 0)]
  if (stats.heal_ > 0) shown.push("heal_")
  return [
    ...BASE_STATS.map(key => {
      const { base, total } = stats[key]
      return {
        key,
        total: formatStat(key, total),
        base: formatStat(key, base),
        // From the rounded numbers, so that the row adds up.
        bonus: formatStat(key, Math.round(total) - Math.round(base)),
      }
    }),
    ...shown.map(key => ({ key, total: formatStat(key, stats[key]) })),
  ]
}
