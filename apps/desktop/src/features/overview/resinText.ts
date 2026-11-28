// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { familyOptions, isUnknown } from "@/domain/customCharacter"
import { weaponFamilyOptions } from "@/domain/customWeapon"
import { materialData } from "@/domain/names"
import {
  type MaterialTotal,
  SPECIALTY_GROUP,
  summaryGroup,
  WEEKLY_BOSS_GROUP,
  WORLD_BOSS_GROUP,
} from "@/domain/plan"
import { CHARACTER_EXP, WEAPON_EXP } from "@/domain/planner"
import { text } from "@/text"

const p = text.planner
const r = text.resinPlan

/** Where a short material comes from, besides the domains that open by weekday. */
const SOURCES = [
  "worldBoss",
  "weeklyBoss",
  "exp",
  "mora",
  "specialty",
  "enemy",
  "weaponExp",
] as const
export type Source = (typeof SOURCES)[number]

// Gems drop from the world bosses as well.
const GEMS = new Set(familyOptions("gem").flat())
const ENEMY = new Set(
  [familyOptions("common"), weaponFamilyOptions("elite"), weaponFamilyOptions("common")].flat(2),
)

function sourceOf(key: string): Source | undefined {
  if (key === CHARACTER_EXP) return "exp"
  if (key === WEAPON_EXP) return "weaponExp"
  if (key === "Mora") return "mora"
  const group = summaryGroup(key)
  if (group === WORLD_BOSS_GROUP || GEMS.has(key)) return "worldBoss"
  if (group === WEEKLY_BOSS_GROUP) return "weeklyBoss"
  if (group === SPECIALTY_GROUP) return "specialty"
  return ENEMY.has(key) ? "enemy" : undefined
}

/** The materials still short, by where they come from. */
export function shortBySource(totals: ReadonlyMap<string, MaterialTotal>) {
  const short = Object.fromEntries(SOURCES.map(source => [source, []])) as unknown as Record<
    Source,
    MaterialTotal[]
  >
  for (const total of totals.values()) {
    if (isUnknown(total.key) || total.have >= total.need) continue
    const source = sourceOf(total.key)
    if (source) short[source].push(total)
  }
  return short
}

/** What the ley line blossoms give that is short: character EXP and Mora. */
export function blossomText(short: Record<Source, readonly MaterialTotal[]>) {
  const parts = (["exp", "mora"] as const).filter(source => short[source].length > 0)
  return parts.length > 0
    ? parts.map(source => r.blossomParts[source]).join(p.listSeparator)
    : undefined
}

/** What costs no resin: local specialties, enemy drops and weapon EXP (forged), those short. */
export function freeText(short: Record<Source, readonly MaterialTotal[]>) {
  const parts = (["specialty", "enemy"] as const).flatMap(source =>
    short[source].length > 0 ? [r.freeParts[source](short[source].length)] : [],
  )
  if (short.weaponExp.length > 0) parts.push(r.freeParts.weaponExp)
  return parts.length > 0 ? parts.join(p.listSeparator) : undefined
}

/** What opens tomorrow, by the materials' names. */
export function tomorrowLine(totals: readonly MaterialTotal[]) {
  return r.tomorrow(totals.map(total => materialData(total.key).name).join(p.listSeparator))
}
