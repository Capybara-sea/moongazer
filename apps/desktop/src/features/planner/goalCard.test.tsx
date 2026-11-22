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
  planCards,
  type WeaponGoal,
} from "@/domain/plan"
import { plannerBag } from "@/domain/planner"
import { text } from "@/text/zh"
import { CustomFields } from "./CustomFields"
import { GoalCard } from "./GoalCard"
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
  return renderToStaticMarkup(<GoalCard card={card} weekday={0} onEdit={noop} onReplace={noop} />)
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
    expect(render(cardOf(sword, ["RaidenShogun"]))).toContain(halved)
    expect(render(cardOf(sword, ["Wanderer"]))).not.toContain(halved)
    const levelOnly = render(cardOf({ ...sword, to: { level: 20, phase: 0 } }, ["RaidenShogun"]))
    expect(levelOnly).toContain(t.approximate)
    expect(levelOnly).not.toContain(halved)
    const custom = (goal: CustomWeaponGoal) => render(cardOf(goal, ["RaidenShogun"]))
    expect(custom({ ...newblade, type: "polearm" })).toContain(halved)
    expect(custom(newblade)).not.toContain(halved)
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
    const off = [cardOf({ ...sword, off: true })]
    expect(renderToStaticMarkup(<SummaryPanel cards={off} />)).toContain(t.summaryEmpty)
    expect(renderToStaticMarkup(<TodayPanel cards={off} weekday={0} />)).toContain(t.todayNone)
    const on = [cardOf(sword)]
    expect(renderToStaticMarkup(<SummaryPanel cards={on} />)).not.toContain(t.summaryEmpty)
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
