// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { convertShort } from "@/domain/convert"
import { type CustomGoal, planCards } from "@/domain/plan"
import { allocate, CHARACTER_EXP, type Line, lowerTier, plannerBag } from "@/domain/planner"
import { formatAmount, formatNumber } from "@/lib/format"
import { text } from "@/text/zh"
import { cardStatus } from "./GoalCard"
import {
  amountTip,
  bagHolds,
  combinedNote,
  haveOfNeed,
  lineView,
  materialTip,
  neededBy,
  shortOf,
} from "./MaterialCell"

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
    expect(combinedNote(line)).toBe(t.combined("2", used.join(t.listSeparator)))
  })

  it("name what combining and converting take, and what converting spends", () => {
    const bag = new Map([
      ["AgnidusAgateChunk", 1],
      ["AgnidusAgateFragment", 3],
      ["ShivadaJadeChunk", 5],
      ["Mora", 100_000],
      ["DustOfAzoth", 100],
    ])
    const [lines] = convertShort(allocate([new Map([["AgnidusAgateChunk", 3]])], bag), bag, ["gem"])
    const [line, dust] = lines ?? []
    if (!line || !dust) throw new Error("no lines")
    const used = [
      t.usedItem("3", lineView("AgnidusAgateFragment").name),
      t.usedMora(formatAmount(900)),
      t.usedItem("1", lineView("ShivadaJadeChunk").name),
      t.usedItem("9", lineView("DustOfAzoth").name),
    ]
    expect(combinedNote(line)).toBe(t.converted("1", "1", used.join(t.listSeparator)))
    expect(shortOf(dust.key, dust.have, dust.need)).toBe("9")
    expect(amountTip(dust.key, dust.have, dust.need)).toEqual({
      lines: [t.convertSpend("9"), undefined],
    })
    expect(amountTip(dust.key, dust.have, dust.need, 100)).toEqual({
      lines: [t.convertSpend("9"), t.inBag("100")],
    })
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

  it("write what is short under the icon, or that it is enough, and have/need in the tip", () => {
    expect(shortOf(top, 15, 21)).toBe("6")
    expect(shortOf(top, 21, 21)).toBe(t.satisfied)
    expect(amountTip(top, 15, 21)).toEqual({ amount: "15/21", lines: [undefined] })
    expect(amountTip(top, 30, 21)).toEqual({ amount: "30/21", lines: [undefined] })
    // A material not known yet: what is needed, and no have to compare it with.
    expect(shortOf("?gem:1", 0, 9)).toBe("9")
    expect(amountTip("?gem:1", 0, 9, 40)).toEqual({ amount: "—/9", lines: [undefined] })
  })

  it("write what the bag holds before the cards share it right after have/need", () => {
    // A later card's share is less than the bag holds.
    expect(amountTip(top, 3, 21, 40)).toEqual({ amount: "3/21", lines: [t.inBag("40")] })
    expect(amountTip(top, 0, 21, 0)).toEqual({ amount: "0/21", lines: [t.inBag("0")] })
    expect(amountTip("Mora", 0, 10, 1_234_567).lines).toEqual([
      t.inBag(text.number.unit("123", text.number.units.tenThousand), true),
    ])
  })

  it("count the bag's EXP as its best item, rounded down, and the rest as they are", () => {
    const materials = new Map([
      ["HerosWit", 3],
      ["AdventurersExperience", 6],
      ["MysticEnhancementOre", 2],
      ["Mora", 500],
    ])
    const exp = lineView(CHARACTER_EXP)
    expect(exp.name).toBe(lineView("HerosWit").name)
    const pooled = bagHolds(materials, CHARACTER_EXP)
    expect(pooled).toBe(3 * 20_000 + 6 * 5_000)
    expect(amountTip(CHARACTER_EXP, 0, 1, pooled).lines).toEqual([t.inBag("4")])
    expect(bagHolds(materials, "Mora")).toBe(500)
    expect(bagHolds(materials, top)).toBe(0)
  })

  it("never write the bag as less than have, which rounds up once it is enough", () => {
    // 65,000 EXP is 3.25 Hero's Wit; a need of 62,000 is 3.1, so have reads 4.
    expect(amountTip(CHARACTER_EXP, 62_000, 62_000, 65_000)).toEqual({
      amount: "4/4",
      lines: [t.inBag("4")],
    })
    // 4.25 still rounds down, to no less than have.
    expect(amountTip(CHARACTER_EXP, 62_000, 62_000, 85_000).lines).toEqual([t.inBag("4")])
    // Short: both round down.
    expect(amountTip(CHARACTER_EXP, 50_000, 100_000, 65_000)).toEqual({
      amount: "2/5",
      lines: [t.inBag("3")],
    })
    const wan = text.number.unit("124", text.number.units.tenThousand)
    expect(amountTip("Mora", 1_234_567, 1_234_567, 1_234_567)).toEqual({
      amount: `${wan}/${wan}`,
      lines: [t.inBag(wan, true)],
    })
  })

  it("write the tip as the name with have/need, what the bag holds, then the rest", () => {
    const html = renderToStaticMarkup(
      materialTip("X", "3/10", [t.inBag("2"), undefined, "note"], ["A"]),
    )
    // The text of each top-level span, one per line of the tip.
    const lines: string[] = []
    let depth = 0
    let line = ""
    for (const [token] of html.matchAll(/<\/?span[^>]*>|[^<]+/g)) {
      if (token.startsWith("</")) {
        depth--
        if (depth > 0) continue
        lines.push(line)
        line = ""
      } else if (token.startsWith("<")) depth++
      else line += token
    }
    expect(lines).toEqual([`X${t.besideName("3/10")}`, t.inBag("2"), "note", t.neededBy(["A"], 1)])
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
