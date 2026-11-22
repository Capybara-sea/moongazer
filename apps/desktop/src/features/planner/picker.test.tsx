// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { characterData, weaponData } from "@/domain/names"
import {
  type CustomWeaponGoal,
  EMPTY_PLAN,
  materialTotals,
  type Plan,
  planCards,
} from "@/domain/plan"
import { DEFAULTS } from "@/domain/planDefaults"
import { defaultOrder, plannerBag } from "@/domain/planner"
import { text } from "@/text/zh"
import {
  characterOptions,
  customGoal,
  NO_FILTERS,
  type Option,
  shownOptions,
  weaponOptions,
  withExpBoost,
} from "./addOptions"
import { GoalCard } from "./GoalCard"
import { GoalPicker } from "./GoalPicker"
import { lineView } from "./MaterialCell"

const t = text.planner
const EMPTY: Account = {
  characters: [],
  weapons: [],
  artifacts: [],
  materials: new Map(),
  characterInfo: new Map(),
}
const TOP = { level: 90, phase: 6 }
const noop = () => undefined

function option(options: readonly Option[], id: string) {
  const found = options.find(o => o.id === id)
  if (!found) throw new Error(`no ${id}`)
  return found
}

describe("new goals", () => {
  it("aim at the defaults, talents by the character's order", () => {
    const goal = option(characterOptions(EMPTY, EMPTY_PLAN), "HuTao").goal()
    const [first, second, third] = defaultOrder("HuTao")
    if (!first || !second || !third) throw new Error("no order")
    expect(goal.to).toEqual({ stage: TOP, talents: { [first]: 9, [second]: 9, [third]: 6 } })
  })

  it("stop where a weapon does, and keep one already past the default", () => {
    const plan: Plan = { ...EMPTY_PLAN, defaults: { ...DEFAULTS, weapon: { level: 80, phase: 5 } } }
    expect(option(weaponOptions(EMPTY, EMPTY_PLAN), "DullBlade").goal().to).toEqual({
      level: 70,
      phase: 4,
    })
    const homa = { key: "StaffOfHoma", level: 90, ascension: 6, refinement: 1, lock: false }
    const account = { ...EMPTY, weapons: [{ ...homa, location: "" }] }
    expect(option(weaponOptions(account, plan), "own-0").goal().to).toEqual(TOP)
    expect(option(weaponOptions(EMPTY, plan), "StaffOfHoma").goal().to).toEqual({
      level: 80,
      phase: 5,
    })
  })

  it("of weapons, custom ones too, take the EXP boost the dialog was set to", () => {
    const weapon = option(weaponOptions(EMPTY, EMPTY_PLAN), "StaffOfHoma").goal()
    expect(withExpBoost(weapon, true)).toEqual({ ...weapon, expBoost: true })
    expect(withExpBoost(weapon, false)).toBe(weapon)
    const custom = customGoal("weapon", DEFAULTS)
    expect(withExpBoost(custom, true)).toEqual({ ...custom, expBoost: true })
    const character = option(characterOptions(EMPTY, EMPTY_PLAN), "HuTao").goal()
    expect(withExpBoost(character, true)).toBe(character)
  })

  it("of custom weapons start as five stars at the default level", () => {
    expect(customGoal("weapon", DEFAULTS)).toEqual({
      kind: "customWeapon",
      name: t.customName.weapon,
      rarity: 5,
      slots: {},
      to: TOP,
    })
  })
})

describe("the picker", () => {
  const characters = characterOptions(EMPTY, EMPTY_PLAN)

  it("filters by element, rarity and weapon type, the custom tile first", () => {
    const filters = { element: "pyro" as const, rarity: 5, weapon: null }
    const shown = shownOptions(characters, "", filters)
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.every(o => o.element === "pyro" && o.rarity === 5)).toBe(true)
    const html = renderToStaticMarkup(
      <GoalPicker
        kind="character"
        options={shown}
        filters={filters}
        onFilters={noop}
        onCustom={noop}
        onPick={noop}
      />,
    )
    const tiles = html.slice(html.indexOf("<ul"))
    expect(tiles.indexOf(t.addCustom.character)).toBeLessThan(
      tiles.indexOf(characterData("HuTao").name),
    )
    expect(html).not.toContain(characterData("Ganyu").name)
    const pressed = text.game.elementLong(text.game.elements.pyro)
    expect(html).toContain(`aria-pressed="true" aria-label="${pressed}"`)
    expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>${text.game.rarity(5)}<`))
  })

  it("leaves out the custom tile when replacing, and marks what is planned", () => {
    const plan: Plan = {
      ...EMPTY_PLAN,
      goals: [{ id: "g", kind: "weapon", key: "StaffOfHoma", to: TOP }],
    }
    const weapons = shownOptions(weaponOptions(EMPTY, plan), "", {
      ...NO_FILTERS,
      weapon: "polearm",
    })
    expect(weapons.every(o => o.weapon === "polearm")).toBe(true)
    const html = renderToStaticMarkup(
      <GoalPicker
        kind="weapon"
        options={weapons}
        filters={NO_FILTERS}
        onFilters={noop}
        onPick={noop}
      />,
    )
    expect(html).not.toContain(t.addCustom.weapon)
    const homa = html.split("<li").find(tile => tile.includes(weaponData("StaffOfHoma").name))
    expect(homa).toContain('disabled=""')
    expect(homa).toContain(`>${t.planned}<`)
    expect(html).not.toContain("title=")
  })
})

describe("a custom weapon's card", () => {
  it("names it, offers the real one, and leaves unknown materials uncounted", () => {
    const goal: CustomWeaponGoal = {
      id: "w",
      kind: "customWeapon",
      name: "Newblade",
      rarity: 4,
      slots: {},
      to: TOP,
    }
    const [card] = planCards({ goals: [goal], focus: "important" }, EMPTY, plannerBag(new Map()))
    if (!card) throw new Error("no card")
    const html = renderToStaticMarkup(
      <GoalCard
        card={card}
        totals={materialTotals([card])}
        weekday={0}
        onEdit={noop}
        onReplace={noop}
      />,
    )
    expect(html).toContain("Newblade")
    expect(html).toContain(t.tags.custom)
    expect(html).toContain(t.replace.weapon)
    expect(html).toContain(t.daysUnknown(t.weaponMaterials))
    const names = card.lines.map(line => lineView(line.key).name)
    expect(names).toContain(t.unknownSlot(t.weaponSlots.elite))
    expect(html).not.toContain(t.satisfied)
  })
})
