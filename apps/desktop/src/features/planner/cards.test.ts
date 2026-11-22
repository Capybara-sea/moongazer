// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { type CustomGoal, planCards } from "@/domain/plan"
import { allocate, type Line, lowerTier, plannerBag } from "@/domain/planner"
import { formatNumber } from "@/lib/format"
import { text } from "@/text/zh"
import { cardStatus } from "./GoalCard"
import { cellAmount, cellTitle, lineView } from "./MaterialCell"

const t = text.planner
const EMPTY: Account = {
  characters: [],
  weapons: [],
  artifacts: [],
  materials: new Map(),
  characterInfo: new Map(),
}

describe("card status", () => {
  const custom: CustomGoal = {
    id: "c",
    kind: "custom",
    name: "Newcomer",
    rarity: 5,
    slots: {},
    to: { stage: { level: 90, phase: 6 }, talents: { auto: 0, skill: 0, burst: 0 } },
  }

  it("is never complete while materials are not known yet", () => {
    const bag = plannerBag(
      new Map([
        ["HerosWit", 1000],
        ["Mora", 10_000_000],
      ]),
    )
    const [card] = planCards({ goals: [custom], focus: "ready" }, EMPTY, bag)
    if (!card) throw new Error("no card")
    expect(cardStatus(card)?.label).toBe(t.status.level)
    expect(cardStatus({ ...card, steps: [] })).toBeUndefined()
  })
})

describe("material cells", () => {
  const top = "PhilosophiesOfElegance"
  const mid = lowerTier(top) ?? ""
  const low = lowerTier(mid) ?? ""

  it("say nothing of combining when it is still not enough", () => {
    const line: Line = {
      key: top,
      need: 21,
      have: 15,
      made: 5,
      bag: 10,
      used: new Map([
        [mid, 15],
        ["Mora", 2_750],
      ]),
    }
    expect(cellTitle(line)).toBe(`${lineView(top).name} 15/21`)
  })

  it("name what combining really takes", () => {
    const [lines] = allocate(
      [new Map([[top, 2]])],
      new Map([
        [low, 18],
        ["Mora", 10_000],
      ]),
    )
    const line = lines?.[0]
    if (!line) throw new Error("no line")
    const used = [t.usedItem(18, lineView(low).name), t.usedMora(2 * 550 + 6 * 175)]
    expect(cellTitle(line)).toBe(
      `${lineView(top).name} ${cellAmount(line)}\n${t.combined("0", 2, used.join(t.listSeparator))}`,
    )
  })

  it("show Mora under 10,000 as it is", () => {
    const mora = lineView("Mora")
    expect(mora.count(5_000, true)).toBe(formatNumber(5_000))
    expect(mora.count(1_200_000, true)).toBe(t.tenThousand(formatNumber(120)))
  })
})
