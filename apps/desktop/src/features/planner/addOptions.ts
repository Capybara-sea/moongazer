// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Account } from "@/domain/account"
import type { Element, WeaponType } from "@/domain/elements"
import { characterData, lookup, weaponData } from "@/domain/names"
import {
  type CharacterGoal,
  type CustomGoal,
  type CustomWeaponGoal,
  characterFrom,
  type Plan,
  type WeaponGoal,
  weaponPlanned,
} from "@/domain/plan"
import { characterTarget, type Defaults, weaponTarget } from "@/domain/planDefaults"
import {
  characterCaps,
  defaultOrder,
  plannableKeys,
  START,
  TALENTS,
  weaponCaps,
} from "@/domain/planner"
import { text } from "@/text/zh"

const t = text.planner

/** A goal before it gets its id. */
export type NewGoal =
  | Omit<CharacterGoal, "id">
  | Omit<WeaponGoal, "id">
  | Omit<CustomGoal, "id">
  | Omit<CustomWeaponGoal, "id">

/** A character or weapon to pick, with what it is filtered by. */
export type Option = {
  id: string
  name: string
  icon?: string
  rarity?: number
  element?: Element
  weapon?: WeaponType
  note: string
  /** The whole note, for hover, where `note` leaves some out. */
  detail?: string
  /** An owned weapon's wielder: a character key, "Traveler" or "". */
  wielder?: string
  owned: boolean
  planned: boolean
  goal: () => NewGoal
}

/** One pick per filter, none for all. */
export type Filters = { element: Element | null; rarity: number | null; weapon: WeaponType | null }
export const NO_FILTERS: Filters = { element: null, rarity: null, weapon: null }

/** The rarities each list can be filtered by. */
export const RARITIES = { character: [5, 4], weapon: [5, 4, 3, 2, 1] } as const

/** A character or weapon not out yet, aimed at the defaults as a released one would be. */
export function customGoal(kind: "character" | "weapon", defaults: Defaults): NewGoal {
  if (kind === "weapon") {
    const rarity = 5
    const to = weaponTarget(defaults, START.stage, weaponCaps(rarity))
    return { kind: "customWeapon", name: t.customName.weapon, rarity, slots: {}, to }
  }
  const to = characterTarget(defaults, START, TALENTS, characterCaps())
  return { kind: "custom", name: t.customName.character, rarity: 5, slots: {}, to }
}

/** A new weapon goal with its EXP boosted when `on`; other goals as they are. */
export function withExpBoost(goal: NewGoal, on: boolean): NewGoal {
  return on && (goal.kind === "weapon" || goal.kind === "customWeapon")
    ? { ...goal, expBoost: true }
    : goal
}

const byRarityThenName = (a: Option, b: Option) =>
  (b.rarity ?? 0) - (a.rarity ?? 0) || a.name.localeCompare(b.name, "zh")

export function characterOptions(account: Account, plan: Plan): Option[] {
  return plannableKeys("character")
    .map((key): Option => {
      const data = characterData(key)
      const [from, standing] = characterFrom(account, key)
      return {
        id: key,
        name: data.name,
        icon: data.icon,
        rarity: data.rarity,
        element: data.element,
        weapon: data.weapon,
        note:
          standing === "owned"
            ? `Lv.${from.stage.level}`
            : standing === "otherElement"
              ? t.tags.otherElement
              : t.unowned,
        owned: standing !== "unowned",
        planned: plan.goals.some(g => g.kind === "character" && g.key === key),
        goal: () => ({
          kind: "character",
          key,
          to: characterTarget(plan.defaults, from, defaultOrder(key), characterCaps()),
        }),
      }
    })
    .toSorted((a, b) => Number(b.owned) - Number(a.owned) || byRarityThenName(a, b))
}

export function weaponOptions(account: Account, plan: Plan): Option[] {
  const plannable = new Set(plannableKeys("weapon"))
  const owned = account.weapons
    .filter(w => plannable.has(w.key))
    .map((w, i, list): Option => {
      const data = weaponData(w.key)
      const copy = list.slice(0, i).filter(o => o.key === w.key && o.location === w.location).length
      // The wielder and copy find the weapon in files without ids, such as imports.
      const pick = { key: w.key, guid: w.guid, wielder: w.location, copy }
      const holder =
        w.location === "" ? t.unequipped : t.wielder(lookup("characters", w.location).name)
      const from = { level: w.level, phase: w.ascension }
      const note = `Lv.${w.level} · ${text.characters.refinement(w.refinement)}`
      return {
        id: `own-${i}`,
        name: data.name,
        icon: data.icon,
        rarity: data.rarity,
        weapon: data.type,
        note,
        detail: `${note} · ${holder}`,
        wielder: w.location,
        owned: true,
        planned: weaponPlanned(plan, account, pick),
        goal: () => ({
          kind: "weapon",
          ...pick,
          to: weaponTarget(plan.defaults, from, weaponCaps(data.rarity ?? 5)),
        }),
      }
    })
    .toSorted(byRarityThenName)
  const ownedKeys = new Set(account.weapons.map(w => w.key))
  const rest = [...plannable]
    .filter(key => !ownedKeys.has(key))
    .map((key): Option => {
      const data = weaponData(key)
      return {
        id: key,
        name: data.name,
        icon: data.icon,
        rarity: data.rarity,
        weapon: data.type,
        note: t.unowned,
        owned: false,
        planned: weaponPlanned(plan, account, { key }),
        goal: () => ({
          kind: "weapon",
          key,
          to: weaponTarget(plan.defaults, START.stage, weaponCaps(data.rarity ?? 5)),
        }),
      }
    })
    .toSorted(byRarityThenName)
  return [...owned, ...rest]
}

/** The options not planned yet that the search and the filters leave. */
export function shownOptions(options: readonly Option[], query: string, filters: Filters) {
  const words = query.trim()
  return options.filter(
    o =>
      !o.planned &&
      (words === "" || o.name.includes(words)) &&
      (filters.element === null || o.element === filters.element) &&
      (filters.rarity === null || o.rarity === filters.rarity) &&
      (filters.weapon === null || o.weapon === filters.weapon),
  )
}
