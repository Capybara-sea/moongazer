// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { type CustomGoal, planCards } from "@/domain/plan"
import { allocate, type Line, lowerTier, plannerBag } from "@/domain/planner"
import { formatAmount, formatNumber } from "@/lib/format"
import { text } from "@/text/zh"
import { cardStatus } from "./GoalCard"
import { amountLines, combinedNote, haveOfNeed, lineView, neededBy, shortOf } from "./MaterialCell"

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
    expect(haveOfNeed(line.key, line.have, line.need)).toBe("15/21")
    expect(combinedNote(line)).toBeUndefined()
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
    const used = [t.usedItem("18", lineView(low).name), t.usedMora(formatAmount(2 * 550 + 6 * 175))]
    expect(combinedNote(line)).toBe(t.combined("0", "2", used.join(t.listSeparator)))
  })

  it("show Mora under 10,000 as it is", () => {
    const mora = lineView("Mora")
    expect(mora.count(5_000, true)).toBe(formatNumber(5_000))
    expect(mora.count(1_200_000, true)).toBe(text.number.unit("120", text.number.units.tenThousand))
  })

  it("round what is needed up and what there is down", () => {
    const mora = lineView("Mora")
    expect(mora.count(1_234_567, true)).toBe(text.number.unit("124", text.number.units.tenThousand))
    expect(mora.count(1_234_567, false)).toBe(
      text.number.unit("123", text.number.units.tenThousand),
    )
  })

  it("show enough as no less than the need", () => {
    const line: Line = { key: "Mora", need: 1_672_500, have: 0, made: 0, bag: 0, used: new Map() }
    expect(haveOfNeed(line.key, 1_672_500, line.need)).toBe(
      `${text.number.unit("168", text.number.units.tenThousand)}/${text.number.unit("168", text.number.units.tenThousand)}`,
    )
    expect(haveOfNeed(line.key, 1_672_501, line.need)).toBe(
      `${text.number.unit("168", text.number.units.tenThousand)}/${text.number.unit("168", text.number.units.tenThousand)}`,
    )
    expect(haveOfNeed(line.key, 1_672_499, line.need)).toBe(
      `${text.number.unit("167", text.number.units.tenThousand)}/${text.number.unit("168", text.number.units.tenThousand)}`,
    )
  })

  it("write what is short under the icon, or that it is enough, and both in the tip", () => {
    expect(shortOf(top, 15, 21)).toBe("6")
    expect(shortOf(top, 21, 21)).toBe(t.satisfied)
    expect(amountLines(top, 15, 21)).toEqual(["15/21", t.stillShort("6")])
    expect(amountLines(top, 30, 21)).toEqual(["30/21", t.satisfied])
    // A material not known yet: what is needed, and no have to compare it with.
    expect(shortOf("?gem:1", 0, 9)).toBe("9")
    expect(amountLines("?gem:1", 0, 9)).toEqual(["—/9", undefined])
  })

  it("name up to eight goals that need them, then count them all", () => {
    expect(neededBy([])).toBeUndefined()
    expect(neededBy(["A", "B"])).toBe(t.neededBy(["A", "B"], 2))
    const many = Array.from({ length: 10 }, (_, i) => `G${i}`)
    expect(neededBy(many)).toBe(t.neededBy(many.slice(0, 8), 10))
    expect(t.neededBy(["A"], 3)).toContain("3")
    expect(t.neededBy(["A", "B"], 2)).not.toContain("2")
  })
})
