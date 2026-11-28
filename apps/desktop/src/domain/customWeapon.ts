// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Costs of a weapon not out yet. All but a few odd released weapons of a
 * rarity fit one template of three material slots; a custom weapon fills a
 * slot with one of the families released weapons use once the player knows
 * it. A slot not known yet names its materials "?w-<slot>:<tier>", apart from
 * a custom character's "?<slot>:<tier>"; no bag holds them and nothing
 * combines into them.
 */

import { planner as data } from "@/domain/gameData"
import {
  type Cost,
  type Need,
  raiseWeaponNeed,
  type Stage,
  type WeaponTerms,
} from "@/domain/planner"
import { isOneOf } from "@/lib/backend/shared"

/** A custom weapon's material kinds, in the order the planner lists them. */
export type WeaponSlot = "weapon" | "elite" | "common"
export const WEAPON_SLOTS: readonly WeaponSlot[] = ["weapon", "elite", "common"]
/** Each known slot's family by the key of its top tier; a slot left out is not known yet. */
export type CustomWeaponSlots = Partial<Record<WeaponSlot, string>>
/** The rarities a weapon not out yet can be given; its costs and EXP go by rarity. */
export const CUSTOM_WEAPON_RARITIES = [3, 4, 5] as const
export type CustomWeaponRarity = (typeof CUSTOM_WEAPON_RARITIES)[number]

type Table = {
  /** By rarity, indexed as `costs`' lists are, a slot's materials named "<slot>:<tier>". */
  customWeaponCosts: Record<string, Cost[]>
  weaponFamilies: Record<WeaponSlot, string[][]>
}

const table: Table = data

/** The families a slot can be filled with, each lowest tier first, in the game's order. */
export function weaponFamilyOptions(slot: WeaponSlot): readonly string[][] {
  return table.weaponFamilies[slot]
}

function material(slots: CustomWeaponSlots, token: string) {
  const [slot, tier] = token.split(":")
  if (!isOneOf(WEAPON_SLOTS, slot)) return token
  const family = table.weaponFamilies[slot].find(f => f.at(-1) === slots[slot])
  return family?.[Number(tier)] ?? `?w-${token}`
}

/** What raising a custom weapon costs: what a released one of its rarity and materials does. */
export function customWeaponNeed(
  rarity: number,
  slots: CustomWeaponSlots,
  from: Stage,
  to: Stage,
  terms: WeaponTerms = {},
): Need {
  const costs = (table.customWeaponCosts[rarity] ?? []).map(cost =>
    Object.fromEntries(
      Object.entries(cost).map(([token, count]) => [material(slots, token), count]),
    ),
  )
  return raiseWeaponNeed(costs, rarity, from, to, terms)
}
