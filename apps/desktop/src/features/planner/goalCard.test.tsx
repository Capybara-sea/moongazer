// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { characterData } from "@/domain/names"
import {
  type Card,
  type CustomGoal,
  type CustomWeaponGoal,
  type Goal,
  MORA_EXP_GROUP,
  materialTotals,
  planCards,
  summaryGroup,
  type WeaponGoal,
} from "@/domain/plan"
import { plannerBag } from "@/domain/planner"
import { text } from "@/text/zh"
import { CustomFields } from "./CustomFields"
import { GoalCard, moraNote } from "./GoalCard"
import { SummaryPanel, TodayPanel } from "./SidePanels"

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
    expect(html).toContain('<span class="font-semibold text-success">1</span>')
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
