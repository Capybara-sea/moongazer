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
import { text } from "@/i18n"
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

  it("finds names whatever their case", () => {
    const filters = { element: null, rarity: null, weapon: null }
    const name = characterData("HuTao").name
    const found = (query: string) => shownOptions(characters, query, filters).map(o => o.name)
    expect(found(name.toUpperCase())).toContain(name)
    expect(found(name.toLowerCase())).toContain(name)
  })

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

  it("leaves out the custom tile when replacing, and what is planned", () => {
    const plan: Plan = {
      ...EMPTY_PLAN,
      goals: [{ id: "g", kind: "weapon", key: "StaffOfHoma", to: TOP }],
    }
    const weapons = shownOptions(weaponOptions(EMPTY, plan), "", {
      ...NO_FILTERS,
      weapon: "polearm",
    })
    expect(weapons.length).toBeGreaterThan(0)
    expect(weapons.every(o => o.weapon === "polearm")).toBe(true)
    expect(weapons.some(o => o.id === "StaffOfHoma")).toBe(false)
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
    expect(html).not.toContain(weaponData("StaffOfHoma").name)
    expect(html).not.toContain("title=")
  })

  it("lists owned ones first, the highest level first, then the rest by rarity", () => {
    const own = (key: string, level: number) => ({
      key,
      level,
      ascension: 0,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
    })
    const arm = (key: string, level: number) => ({
      key,
      level,
      ascension: 0,
      refinement: 1,
      lock: false,
      location: "",
    })
    const account: Account = {
      ...EMPTY,
      characters: [own("HuTao", 70), own("Xiangling", 90), own("Ganyu", 80)],
      weapons: [arm("StaffOfHoma", 20), arm("DullBlade", 70), arm("TheCatch", 50)],
    }
    const characters = characterOptions(account, EMPTY_PLAN)
    expect(characters.slice(0, 3).map(o => o.id)).toEqual(["Xiangling", "Ganyu", "HuTao"])
    expect(characters[3]?.owned).toBe(false)
    expect(characters[3]?.rarity).toBe(5)
    const weapons = weaponOptions(account, EMPTY_PLAN)
    expect(weapons.slice(0, 3).map(o => o.name)).toEqual(
      ["DullBlade", "TheCatch", "StaffOfHoma"].map(key => weaponData(key).name),
    )
    expect(weapons[3]?.owned).toBe(false)
    expect(weapons[3]?.rarity).toBe(5)
  })

  it("writes an owned weapon's level and refinement under it", () => {
    const homa = { key: "StaffOfHoma", level: 90, ascension: 6, refinement: 5, lock: false }
    const account = { ...EMPTY, weapons: [{ ...homa, location: "" }] }
    const owned = option(weaponOptions(account, EMPTY_PLAN), "own-0")
    expect(owned.note).toBe(`Lv.90 · ${text.characters.refinement(5)}`)
    expect(owned.detail).toContain(owned.note)
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
    // Not known yet: what is needed, muted, never counted short.
    const unknown = card.lines.filter(line => lineView(line.key).unknown)
    expect(unknown.length).toBeGreaterThan(0)
    for (const line of unknown) {
      expect(html).toContain(`text-muted">${lineView(line.key).count(line.need, true)}</span>`)
    }
  })
})
