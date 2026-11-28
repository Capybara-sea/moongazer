// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { convertShort } from "@/domain/convert"
import { characterData } from "@/domain/names"
import {
  type Card,
  type CustomGoal,
  type CustomWeaponGoal,
  type Goal,
  type MaterialTotal,
  MORA_EXP_GROUP,
  materialTotals,
  planCards,
  summaryGroup,
  WEEKLY_BOSS_GROUP,
  type WeaponGoal,
  WORLD_BOSS_GROUP,
} from "@/domain/plan"
import { allocate, type Line, plannerBag } from "@/domain/planner"
import { text } from "@/i18n"
import { CustomFields } from "./CustomFields"
import { GoalCard, moraNote } from "./GoalCard"
import { lineView, MaterialCell } from "./MaterialCell"
import { SummaryPanel, TodayPanel, totalTip } from "./SidePanels"

const t = text.planner
const TOP = { level: 90, phase: 6 }
const noop = () => undefined

function account(owners: string[] = []): Account {
  return {
    characters: owners.map(key => ({
      key,
      level: 1,
      ascension: 0,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
    })),
    weapons: [],
    artifacts: [],
    materials: new Map(),
    characterInfo: new Map(),
  }
}

function cardOf(goal: Goal, owners: string[] = []): Card {
  const [card] = planCards(
    { goals: [goal], focus: "important" },
    account(owners),
    plannerBag(new Map()),
  )
  if (!card) throw new Error("no card")
  return card
}

function render(card: Card) {
  return renderToStaticMarkup(
    <GoalCard
      card={card}
      totals={materialTotals([card])}
      weekday={0}
      onEdit={noop}
      onReplace={noop}
    />,
  )
}

const sword: WeaponGoal = { id: "s", kind: "weapon", key: "MistsplitterReforged", to: TOP }
const newblade: CustomWeaponGoal = {
  id: "c",
  kind: "customWeapon",
  name: "Newblade",
  rarity: 5,
  slots: {},
  to: TOP,
}

describe("a weapon's card", () => {
  it("tags the weapon while its EXP is boosted", () => {
    expect(render(cardOf({ ...sword, expBoost: true }))).toContain(t.expBoostTag)
    expect(render(cardOf(sword))).not.toContain(t.expBoostTag)
  })

  it("says on the Mora whose passive halved the ascensions, while any are left", () => {
    const halved = t.moraHalved(characterData("RaidenShogun").name)
    expect(moraNote(cardOf(sword, ["RaidenShogun"]))).toBe(halved)
    expect(moraNote(cardOf(sword, ["Wanderer"]))).toBeUndefined()
    const levelOnly = cardOf({ ...sword, to: { level: 20, phase: 0 } }, ["RaidenShogun"])
    expect(moraNote(levelOnly)).toBeUndefined()
    const custom = (goal: CustomWeaponGoal) => moraNote(cardOf(goal, ["RaidenShogun"]))
    expect(custom({ ...newblade, type: "polearm" })).toBe(halved)
    expect(custom(newblade)).toBeUndefined()
  })
})

describe("a card's goals", () => {
  it("show one reached in green, with no tick", () => {
    const goal: Goal = {
      id: "h",
      kind: "character",
      key: "HuTao",
      to: { stage: { level: 1, phase: 0 }, talents: { auto: 0, skill: 0, burst: 0 } },
    }
    const html = render(cardOf(goal, ["HuTao"]))
    expect(html).toContain('<span class="font-semibold text-(--ok)">1</span>')
    expect(html).not.toContain("lucide-check")
  })
})

describe("the summary", () => {
  const totals = materialTotals([cardOf(sword)])
  const other = [...totals.keys()].map(summaryGroup).find(id => id !== MORA_EXP_GROUP) ?? ""

  it("filters with a checkbox, as the collection pages do", () => {
    expect(renderToStaticMarkup(<SummaryPanel totals={totals} />)).toContain('type="checkbox"')
  })

  it("lists the groups in the order the player set", () => {
    expect(other).not.toBe("")
    const plain = renderToStaticMarkup(<SummaryPanel totals={totals} />)
    expect(plain.indexOf(t.moraExp)).toBeLessThan(plain.indexOf(other))
    const moved = renderToStaticMarkup(
      <SummaryPanel totals={totals} order={[other, MORA_EXP_GROUP]} />,
    )
    expect(moved.indexOf(other)).toBeLessThan(moved.indexOf(t.moraExp))
  })

  const total = (key: string, need: number, have: number, converted = 0): MaterialTotal => ({
    key,
    need,
    have,
    made: 0,
    converted,
    spentElsewhere: 0,
    goals: [],
  })
  const byKey = (...list: MaterialTotal[]) => new Map(list.map(each => [each.key, each]))

  it("keeps what converting makes up and what it is paid in among what is short, marked", () => {
    const html = renderToStaticMarkup(
      <SummaryPanel
        totals={byKey(
          total("AgnidusAgateChunk", 3, 3, 2),
          total("DustOfAzoth", 18, 18),
          total("Mora", 10, 10),
          { ...total("AgnidusAgateGemstone", 1, 1), made: 1 },
        )}
      />,
    )
    expect(html).toContain(`alt="${lineView("AgnidusAgateChunk").name}"`)
    expect(html).toContain(`alt="${lineView("DustOfAzoth").name}"`)
    expect(html).not.toContain(`alt="${lineView("Mora").name}"`)
    // What combining alone makes up is left out.
    expect(html).not.toContain(`alt="${lineView("AgnidusAgateGemstone").name}"`)
    expect(html).toContain(`>${t.convertMark}<`)
  })

  it("writes x as the bag less what combining others used, so it adds up with what is short", () => {
    // Card 1 combines its book from all 9 Teachings; card 2 then needs 6 Teachings itself.
    const bag = new Map([
      ["TeachingsOfFreedom", 9],
      ["Mora", 1_000_000],
    ])
    const cards = allocate(
      [new Map([["PhilosophiesOfFreedom", 1]]), new Map([["TeachingsOfFreedom", 6]])],
      bag,
    ).map(lines => ({ ...cardOf(sword), lines }))
    const totals = materialTotals(cards)
    const teachings = totals.get("TeachingsOfFreedom")
    if (!teachings) throw new Error("no total")
    expect(teachings).toMatchObject({ need: 6, have: 0, spentElsewhere: 9 })
    // The bag goes unsaid: over every card nothing is shared.
    expect(totalTip(teachings, 9)).toEqual({
      amount: "0/6",
      lines: [undefined, undefined],
      recipe: undefined,
    })
    expect(totalTip(teachings, undefined).amount).toBe("—/6")
  })

  it("adds up every card's combining into one recipe a step, the lowest tier first", () => {
    // Card 1 combines its book from the 3 Guides; card 2 from 9 Teachings, by way of 3 Guides.
    const bag = new Map([
      ["TeachingsOfFreedom", 9],
      ["GuideToFreedom", 3],
      ["Mora", 1_000_000],
    ])
    const book = new Map([["PhilosophiesOfFreedom", 1]])
    const cards = allocate([book, book], bag).map(lines => ({ ...cardOf(sword), lines }))
    const total = materialTotals(cards).get("PhilosophiesOfFreedom")
    if (!total) throw new Error("no total")
    expect(total).toMatchObject({
      need: 2,
      have: 2,
      made: 2,
      steps: [
        { from: "TeachingsOfFreedom", count: 9, to: "GuideToFreedom", made: 3 },
        { from: "GuideToFreedom", count: 6, to: "PhilosophiesOfFreedom", made: 2 },
      ],
    })
    const { amount, lines, recipe } = totalTip(total, 0)
    expect(amount).toBe("0/2")
    expect(lines).toEqual([undefined, undefined])
    const html = renderToStaticMarkup(recipe)
    expect(html.match(/lucide-arrow-right/g)).toHaveLength(2)
    for (const count of ["9", "3", "6", "2"]) expect(html).toContain(t.times(count))
    expect(html).toContain(t.afterRecipes(t.recipeKinds.combine))
    expect(html).not.toContain(t.inBag("0"))
  })

  it("adds up every card's converting into one recipe, with what it is paid in", () => {
    const bag = new Map([
      ["ShivadaJadeChunk", 5],
      ["DustOfAzoth", 100],
      ["Mora", 1_000_000],
    ])
    const chunk = new Map([["AgnidusAgateChunk", 1]])
    const cards = convertShort(allocate([chunk, chunk], bag), bag, ["gem"]).map(lines => ({
      ...cardOf(sword),
      lines,
    }))
    const total = materialTotals(cards).get("AgnidusAgateChunk")
    if (!total) throw new Error("no total")
    expect(total.steps).toBeUndefined()
    expect(total.converted).toBe(2)
    expect(total.conversion).toEqual({
      count: 2,
      from: new Map([["ShivadaJadeChunk", 2]]),
      cost: "DustOfAzoth",
      paid: 18,
    })
    const html = renderToStaticMarkup(totalTip(total, 0).recipe)
    expect(html).toContain(t.recipeKinds.convert)
    for (const count of ["2", "18"]) expect(html).toContain(t.times(count))
    expect(html).toContain(t.afterRecipes(t.recipeKinds.convert))
  })

  it("puts the weekly bosses' drops before the world bosses' by default", () => {
    expect(summaryGroup("DvalinsPlume")).toBe(WEEKLY_BOSS_GROUP)
    expect(summaryGroup("HurricaneSeed")).toBe(WORLD_BOSS_GROUP)
    const html = renderToStaticMarkup(
      <SummaryPanel totals={byKey(total("HurricaneSeed", 2, 0), total("DvalinsPlume", 2, 0))} />,
    )
    expect(html.indexOf(t.weeklyBoss)).toBeLessThan(html.indexOf(t.worldBoss))
  })
})

describe("a card switched off", () => {
  it("fades, lists no materials and says so, its switch on", () => {
    const off = render(cardOf({ ...sword, off: true }))
    expect(off).toContain(t.status.off)
    expect(off).toContain('aria-checked="true"')
    expect(off).toContain("opacity-45")
    expect(off).not.toContain("<ul")
    const on = render(cardOf(sword))
    expect(on).not.toContain(t.status.off)
    expect(on).toContain('aria-checked="false"')
    expect(on).toContain("<ul")
  })

  it("is left out of today's and the summary's materials", () => {
    const off = materialTotals([cardOf({ ...sword, off: true })])
    expect(renderToStaticMarkup(<SummaryPanel totals={off} />)).toContain(t.summaryEmpty)
    expect(renderToStaticMarkup(<TodayPanel totals={off} weekday={0} />)).toContain(t.todayNone)
    const on = materialTotals([cardOf(sword)])
    expect(renderToStaticMarkup(<SummaryPanel totals={on} />)).not.toContain(t.summaryEmpty)
  })
})

describe("a custom weapon's fields", () => {
  const typeField = (html: string) => html.slice(html.indexOf(t.weaponType)).split("</button>")[0]

  it("pick its type, not known at first", () => {
    const unknown = renderToStaticMarkup(<CustomFields goal={newblade} update={noop} />)
    expect(typeField(unknown)).toContain(t.unknown)
    const typed = { ...newblade, type: "polearm" as const }
    const polearm = renderToStaticMarkup(<CustomFields goal={typed} update={noop} />)
    expect(typeField(polearm)).toContain(text.game.weaponTypes.polearm)
  })

  it("leave the type out for a character", () => {
    const goal: CustomGoal = {
      id: "n",
      kind: "custom",
      name: "Newcomer",
      rarity: 5,
      slots: {},
      to: { stage: TOP, talents: { auto: 0, skill: 0, burst: 0 } },
    }
    const html = renderToStaticMarkup(<CustomFields goal={goal} update={noop} />)
    expect(html).not.toContain(t.weaponType)
  })
})

describe("a material cell", () => {
  const converted: Line = {
    key: "AgnidusAgateChunk",
    need: 3,
    have: 3,
    made: 0,
    bag: 1,
    used: new Map(),
    converted: {
      count: 2,
      from: new Map([["ShivadaJadeChunk", 2]]),
      cost: "DustOfAzoth",
      paid: 18,
    },
  }
  const cell = (line: Line) =>
    renderToStaticMarkup(
      <ul>
        <MaterialCell line={line} goals={[]} />
      </ul>,
    )

  it("marks one converting makes enough, amber, as combining does", () => {
    const html = cell(converted)
    expect(html).toContain(`>${t.convertMark}<`)
    expect(html).toContain("text-(--warn)")
    expect(cell({ ...converted, have: 2 })).not.toContain(`>${t.convertMark}<`)
  })

  it("fades one with enough and what conversions spend, not one short, converted or not known yet", () => {
    const plain = { ...converted, converted: undefined }
    expect(cell(plain)).toContain("opacity-40")
    expect(cell({ ...plain, key: "DustOfAzoth" })).toContain("opacity-40")
    expect(cell({ ...plain, have: 2 })).not.toContain("opacity-40")
    expect(cell(converted)).not.toContain("opacity-40")
    expect(cell({ ...plain, key: "?gem:1" })).not.toContain("opacity-40")
  })
})
