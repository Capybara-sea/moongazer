// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Costs of a character not out yet. Every released character's costs fit one
 * template of six material slots; a custom character fills a slot with one of
 * the families released characters use once the player knows it. A slot not
 * known yet names its materials "?<slot>:<tier>", which no bag holds and
 * nothing combines into.
 */

import { WEAPON_SLOTS, type WeaponSlot } from "@/domain/customWeapon"
import { planner as data } from "@/domain/gameData"
import { type CharacterState, type Cost, type Need, raiseNeed } from "@/domain/planner"
import { isOneOf } from "@/lib/backend/shared"

/** A custom character's material kinds, in the order the planner lists them. */
export type Slot = "common" | "specialty" | "boss" | "gem" | "book" | "weekly"
export const SLOTS: readonly Slot[] = ["common", "specialty", "boss", "gem", "book", "weekly"]
/** Each known slot's family by the key of its top tier; a slot left out is not known yet. */
export type CustomSlots = Partial<Record<Slot, string>>

type Table = {
  /** Indexed as `costs`' lists are, a slot's materials named "<slot>:<tier>", tier 0 the lowest. */
  customCosts: { ascension: Cost[]; talent: Cost[] }
  families: Record<Slot, string[][]>
}

const table: Table = data

/** The families a slot can be filled with, each lowest tier first, in the game's order. */
export function familyOptions(slot: Slot): readonly string[][] {
  return table.families[slot]
}

function material(slots: CustomSlots, token: string) {
  const [slot, tier] = token.split(":")
  if (!isOneOf(SLOTS, slot)) return token
  const family = table.families[slot].find(f => f.at(-1) === slots[slot])
  return family?.[Number(tier)] ?? `?${token}`
}

function fill(slots: CustomSlots, costs: readonly Cost[]): Cost[] {
  return costs.map(cost =>
    Object.fromEntries(
      Object.entries(cost).map(([token, count]) => [material(slots, token), count]),
    ),
  )
}

/** What raising a custom character costs; its three talents cost alike, as everyone's do. */
export function customNeed(slots: CustomSlots, from: CharacterState, to: CharacterState): Need {
  const talent = fill(slots, table.customCosts.talent)
  return raiseNeed(fill(slots, table.customCosts.ascension), [talent, talent, talent], from, to)
}

/** A material of a custom character's or weapon's slot that is not known yet. */
export function isUnknown(key: string) {
  return key.startsWith("?")
}

/** The slot and tier a material not known yet stands for, of a custom character or weapon. */
export type UnknownSlot =
  | { of: "character"; slot: Slot; tier: number }
  | { of: "weapon"; slot: WeaponSlot; tier: number }

export function unknownSlot(key: string): UnknownSlot | undefined {
  const [, weapon, slot, tier] = /^\?(w-)?(\w+):(\d+)$/.exec(key) ?? []
  if (weapon) {
    return isOneOf(WEAPON_SLOTS, slot) ? { of: "weapon", slot, tier: Number(tier) } : undefined
  }
  return isOneOf(SLOTS, slot) ? { of: "character", slot, tier: Number(tier) } : undefined
}
