// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The seven elements in the game's order, with the icons the game uses for
 * them. Their colors are the --el-* variables in index.css.
 */

export const ELEMENTS = ["pyro", "hydro", "anemo", "electro", "dendro", "cryo", "geo"] as const
export type Element = (typeof ELEMENTS)[number]

export const ELEMENT_ICONS: Record<Element, string> = {
  pyro: "UI_Buff_Element_Fire",
  hydro: "UI_Buff_Element_Water",
  anemo: "UI_Buff_Element_Wind",
  electro: "UI_Buff_Element_Electric",
  dendro: "UI_Buff_Element_Grass",
  cryo: "UI_Buff_Element_Ice",
  geo: "UI_Buff_Element_Rock",
}

export function isElement(value: unknown): value is Element {
  return ELEMENTS.some(element => element === value)
}

export const WEAPON_TYPES = ["sword", "claymore", "polearm", "bow", "catalyst"] as const
export type WeaponType = (typeof WEAPON_TYPES)[number]

export function isWeaponType(value: unknown): value is WeaponType {
  return WEAPON_TYPES.some(type => type === value)
}
