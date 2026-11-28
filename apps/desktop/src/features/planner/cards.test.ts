// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { convertShort } from "@/domain/convert"
import { type CustomGoal, planCards } from "@/domain/plan"
import {
  allocate,
  CHARACTER_EXP,
  type Line,
  lowerTier,
  plannerBag,
  WEAPON_EXP,
} from "@/domain/planner"
import { formatNumber } from "@/lib/format"
import { text } from "@/text"
import { cardStatus } from "./GoalCard"
import {
  amountTip,
  bagHolds,
  cellLabel,
  lineMadeUp,
  lineView,
  materialTip,
  neededBy,
  recipeNote,
  recipes,
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
  // A card's line as its cell gives it to `recipeNote`.
  const onCard = (line: Line) => ({ ...lineMadeUp(line), need: line.need, have: line.have })

  it("write combining even when it is still not enough, and what is needed after it", () => {
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
    expect(amountTip(line.key, line.bag, line.need).amount).toBe("10/21")
    expect(recipes(lineMadeUp(line))).toEqual([
      { kind: "combine", inputs: [[mid, 15]], output: [top, 5] },
    ])
    const html = renderToStaticMarkup(recipeNote(onCard(line)))
    expect(html).toContain(t.afterRecipes(t.recipeKinds.combine, "6"))
    // The bag goes on the same line, before it.
    const withBag = renderToStaticMarkup(recipeNote(onCard(line), t.inBag("10")))
    expect(withBag).toContain(
      `${t.inBag("10")}${t.clauseSeparator}${t.afterRecipes(t.recipeKinds.combine, "6")}`,
    )
  })

  it("write combining as a recipe for each tier, the lowest first", () => {
    const [lines] = allocate(
      [new Map([[top, 2]])],
      new Map([
        [low, 18],
        ["Mora", 10_000],
      ]),
    )
    const line = lines?.[0]
    if (!line) throw new Error("no line")
    expect(recipes(lineMadeUp(line))).toEqual([
      {
        kind: "combine",
        inputs: [[low, 18]],
        output: [mid, 6],
      },
      {
        kind: "combine",
        inputs: [[mid, 6]],
        output: [top, 2],
      },
    ])
    expect(line.used.get("Mora")).toBe(6 * 175 + 2 * 550)
    const html = renderToStaticMarkup(recipeNote(onCard(line)))
    expect(html.match(/lucide-arrow-right/g)).toHaveLength(2)
    for (const key of [low, mid, top]) expect(html).toContain(`alt="${lineView(key).name}"`)
    expect(html).not.toContain(`alt="${lineView("Mora").name}"`)
    expect(html).toContain(t.times("18"))
    expect(html).toContain(t.afterRecipes(t.recipeKinds.combine))
  })

  it("count what the bag holds of a middle tier in the step above", () => {
    const bag = new Map([
      [mid, 2],
      [low, 12],
      ["Mora", 10_000],
    ])
    const [lines] = allocate([new Map([[top, 2]])], bag)
    const line = lines?.[0]
    if (!line) throw new Error("no line")
    expect(recipes(lineMadeUp(line))?.map(recipe => [recipe.inputs[0], recipe.output])).toEqual([
      [
        [low, 12],
        [mid, 4],
      ],
      [
        [mid, 6],
        [top, 2],
      ],
    ])
  })

  it("write converting as a recipe after combining, and what converting spends", () => {
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
    expect(recipes(lineMadeUp(line))).toEqual([
      {
        kind: "combine",
        inputs: [["AgnidusAgateFragment", 3]],
        output: ["AgnidusAgateChunk", 1],
      },
      {
        kind: "convert",
        inputs: [
          ["ShivadaJadeChunk", 1],
          ["DustOfAzoth", 9],
        ],
        output: ["AgnidusAgateChunk", 1],
      },
    ])
    const html = renderToStaticMarkup(recipeNote(onCard(line)))
    expect(html.match(/lucide-plus/g)).toHaveLength(1)
    expect(html.match(/lucide-arrow-right/g)).toHaveLength(2)
    expect(html).toContain(t.recipeKinds.convert)
    expect(html).toContain(`alt="${lineView("DustOfAzoth").name}"`)
    const by = [t.recipeKinds.combine, t.recipeKinds.convert].join(t.listSeparator)
    expect(html).toContain(t.afterRecipes(by))
    expect(amountTip(line.key, line.bag, line.need).amount).toBe("1/3")
    expect(cellLabel(dust.key, dust.have, dust.need)).toBe("9")
    expect(amountTip(dust.key, dust.bag, dust.need, 100)).toEqual({
      amount: "100/9",
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
    const wan = (n: string) => text.number.unit(n, text.number.units.tenThousand)
    expect(amountTip("Mora", 1_672_500, 1_672_500).amount).toBe(`${wan("168")}/${wan("168")}`)
    expect(amountTip("Mora", 1_672_501, 1_672_500).amount).toBe(`${wan("168")}/${wan("168")}`)
    expect(amountTip("Mora", 1_672_499, 1_672_500).amount).toBe(`${wan("167")}/${wan("168")}`)
  })

  it("write what is short under the icon, or what is needed once enough, and x/y in the tip", () => {
    expect(cellLabel(top, 15, 21)).toBe(t.short("6"))
    expect(cellLabel(top, 21, 21)).toBe("21")
    expect(cellLabel(top, 30, 21)).toBe("21")
    expect(amountTip(top, 15, 21)).toEqual({ amount: "15/21", lines: [undefined, undefined] })
    expect(amountTip(top, 30, 21)).toEqual({ amount: "30/21", lines: [undefined, undefined] })
    // A material not known yet: what is needed, and nothing there is to compare it with.
    expect(cellLabel("?gem:1", 0, 9)).toBe("9")
    expect(amountTip("?gem:1", 0, 9, 40)).toEqual({ amount: "—/9", lines: [undefined, undefined] })
    // No account to read the bag of.
    expect(amountTip(top, undefined, 21).amount).toBe("—/21")
  })

  it("say what the bag holds, and what the cards before took of it when they took some", () => {
    expect(amountTip(top, 3, 21, 40)).toEqual({
      amount: "3/21",
      lines: [undefined, t.sharedBag("40", "37")],
    })
    expect(amountTip(top, 0, 21, 0).lines).toEqual([undefined, t.inBag("0")])
    expect(amountTip(top, 40, 21, 40).lines).toEqual([undefined, t.inBag("40")])
    const wan = text.number.unit("123", text.number.units.tenThousand)
    expect(amountTip("Mora", 0, 10, 1_234_567).lines).toEqual([
      undefined,
      t.sharedBag(wan, wan, true),
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
    expect(amountTip(CHARACTER_EXP, 0, 1, pooled).lines).toEqual([
      t.expEquivalent.character,
      t.sharedBag("4", "4"),
    ])
    expect(amountTip(WEAPON_EXP, 0, 1, bagHolds(materials, WEAPON_EXP)).lines[0]).toBe(
      t.expEquivalent.weapon,
    )
    expect(amountTip(top, 0, 1, 0).lines[0]).toBeUndefined()
    expect(bagHolds(materials, "Mora")).toBe(500)
    expect(bagHolds(materials, top)).toBe(0)
  })

  it("never write the bag as less than x, which rounds up once it is enough", () => {
    // A need of 62,000 EXP is 3.1 Hero's Wit, so x reads 4; 3,000 taken is not one item.
    expect(amountTip(CHARACTER_EXP, 62_000, 62_000, 65_000)).toEqual({
      amount: "4/4",
      lines: [t.expEquivalent.character, t.inBag("4")],
    })
    // 85,000 is 4.25, rounded up as x is.
    expect(amountTip(CHARACTER_EXP, 62_000, 62_000, 85_000).lines).toEqual([
      t.expEquivalent.character,
      t.sharedBag("5", "1"),
    ])
    // Short: both round down.
    expect(amountTip(CHARACTER_EXP, 50_000, 100_000, 90_000)).toEqual({
      amount: "2/5",
      lines: [t.expEquivalent.character, t.sharedBag("4", "2")],
    })
    // What went is the bag less x as written: 3.25 and 1.5 read 3 and 1, so 2 went, not 1.75's 1.
    expect(amountTip(CHARACTER_EXP, 30_000, 100_000, 65_000)).toEqual({
      amount: "1/5",
      lines: [t.expEquivalent.character, t.sharedBag("3", "2")],
    })
    const wan = text.number.unit("124", text.number.units.tenThousand)
    expect(amountTip("Mora", 1_234_567, 1_234_567, 1_234_567)).toEqual({
      amount: `${wan}/${wan}`,
      lines: [undefined, t.inBag(wan, true)],
    })
  })

  it("write the tip as the name with x/y, the lines given, the recipes, then the goals", () => {
    const html = renderToStaticMarkup(
      materialTip(
        "X",
        "3/10",
        [t.sharedBag("5", "2"), undefined, "note"],
        ["A"],
        createElement("span", null, "recipe"),
      ),
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
    expect(lines).toEqual([
      `X${t.besideName("3/10")}`,
      t.sharedBag("5", "2"),
      "note",
      "recipe",
      t.neededBy(["A"], 1),
    ])
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
