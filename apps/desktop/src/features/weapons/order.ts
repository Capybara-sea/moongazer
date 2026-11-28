// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { WeaponType } from "@/domain/elements"
import type { Weapon } from "@/domain/good"
import { lookup, weaponData } from "@/domain/names"
import { lang } from "@/i18n"
import type { WeaponSort } from "@/stores/weaponListStore"

/** A weapon with what the name table says about it, as the table and cards show it. */
export type WeaponRow = {
  /** The weapon's place in the export: weapons have no id of their own. */
  id: number
  weapon: Weapon
  name: string
  icon?: string
  /** Unknown for keys newer than the bundled data. */
  rarity?: number
  type?: WeaponType
  /** The wielder's name and icon; none when unequipped. */
  wielder?: { name: string; icon?: string }
}

export function weaponRows(weapons: readonly Weapon[]): WeaponRow[] {
  return weapons.map((weapon, id) => ({
    id,
    weapon,
    ...weaponData(weapon.key),
    wielder: weapon.location ? lookup("characters", weapon.location) : undefined,
  }))
}

/** The numbers in the page's subtitle. */
export function weaponCounts(rows: readonly WeaponRow[]) {
  const count = (test: (row: WeaponRow) => boolean) => rows.filter(test).length
  return {
    total: rows.length,
    five: count(row => row.rarity === 5),
    four: count(row => row.rarity === 4),
    equipped: count(row => row.weapon.location !== ""),
  }
}

/** The sort options, in the priority ties fall back on. */
export const WEAPON_SORTS: readonly WeaponSort[] = ["rarity", "level", "refinement"]

const VALUES: Record<WeaponSort, (row: WeaponRow) => number> = {
  rarity: row => row.rarity ?? 0,
  level: row => row.weapon.level,
  refinement: row => row.weapon.refinement,
}

type Options = { type: WeaponType | null; onlyFree: boolean; sort: WeaponSort }

/**
 * The rows the table and cards show, in their order: filtered by type and, if asked,
 * to unequipped weapons; sorted by the chosen value, then by the other two in
 * the order rarity, level, refinement, all highest first, then by name and key.
 */
export function visibleWeapons(rows: readonly WeaponRow[], options: Options) {
  const sorts = [options.sort, ...WEAPON_SORTS.filter(sort => sort !== options.sort)]
  return rows
    .filter(row => options.type === null || row.type === options.type)
    .filter(row => !options.onlyFree || row.weapon.location === "")
    .sort(
      (a, b) =>
        sorts.reduce((order, sort) => order || VALUES[sort](b) - VALUES[sort](a), 0) ||
        a.name.localeCompare(b.name, lang) ||
        a.weapon.key.localeCompare(b.weapon.key),
    )
}
