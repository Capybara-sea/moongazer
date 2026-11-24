// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { materialData } from "@/domain/names"
import type { MaterialTotal } from "@/domain/plan"
import { CHARACTER_EXP, WEAPON_EXP } from "@/domain/planner"
import { text } from "@/text/zh"
import { blossomText, freeText, shortBySource, tomorrowLine } from "./resinText"

const r = text.resinPlan
const p = text.planner

const total = (key: string, need: number, have: number): MaterialTotal => ({
  key,
  need,
  have,
  made: 0,
  converted: 0,
  spentElsewhere: 0,
  goals: [],
})
const totals = (...list: MaterialTotal[]) => new Map(list.map(each => [each.key, each]))

describe("where short materials come from", () => {
  const counts = shortBySource(
    totals(
      total("EverflameSeed", 46, 10),
      total("AgnidusAgateGemstone", 6, 0),
      total("DvalinsPlume", 18, 2),
      total("Cecilia", 168, 20),
      total("SlimeCondensate", 18, 3),
      total("Mora", 1e6, 0),
      total(CHARACTER_EXP, 4e5, 0),
      total("TeachingsOfFreedom", 9, 0),
      total("SlimeSecretions", 30, 30),
    ),
  )

  it("sorts the materials short by where they come from", () => {
    const keys = Object.fromEntries(
      Object.entries(counts).map(([source, list]) => [source, list.map(total => total.key)]),
    )
    expect(keys).toEqual({
      worldBoss: ["EverflameSeed", "AgnidusAgateGemstone"],
      weeklyBoss: ["DvalinsPlume"],
      exp: [CHARACTER_EXP],
      mora: ["Mora"],
      specialty: ["Cecilia"],
      enemy: ["SlimeCondensate"],
      weaponExp: [],
    })
  })

  it("writes the ley line blossoms and what costs no resin", () => {
    expect(blossomText(counts)).toBe(
      [r.blossomParts.exp, r.blossomParts.mora].join(p.listSeparator),
    )
    expect(freeText(counts)).toBe(
      [r.freeParts.specialty(1), r.freeParts.enemy(1)].join(p.listSeparator),
    )
  })

  it("counts weapon EXP, which is forged, with what costs no resin", () => {
    const ore = shortBySource(totals(total(WEAPON_EXP, 1e5, 0)))
    expect(freeText(ore)).toBe(r.freeParts.weaponExp)
  })

  it("says nothing of a source with nothing short", () => {
    const none = shortBySource(totals(total("Cecilia", 10, 10)))
    expect([blossomText(none), freeText(none)]).toEqual([undefined, undefined])
  })
})

describe("tomorrow's materials", () => {
  it("names tomorrow's materials", () => {
    expect(tomorrowLine([total("TeachingsOfFreedom", 9, 0)])).toBe(
      r.tomorrow(materialData("TeachingsOfFreedom").name),
    )
  })
})
