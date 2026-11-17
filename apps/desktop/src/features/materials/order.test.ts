// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { MATERIAL_TABS, type MaterialTab, materialData } from "@/domain/names"
import { text } from "@/text/zh"
import {
  type MaterialRow,
  materialRows,
  tabCounts,
  tabGroups,
  takeRows,
  visibleRows,
} from "./order"

const counts = (entries: Record<string, number>) => new Map(Object.entries(entries))
const leyline = (entries: Record<string, number>) => ({ leyline: true, materials: counts(entries) })
const good = (entries: Record<string, number>) => ({ leyline: false, materials: counts(entries) })
const summary = (rows: readonly MaterialRow[]) => rows.map(r => [r.key, r.count, r.change])
const all = { onlyChanged: false, query: "" }

describe("materialRows", () => {
  it("lists what is held, with the change since the previous snapshot", () => {
    const rows = materialRows(
      leyline({ Mora: 1500, Primogem: 160, HerosWit: 0 }),
      leyline({ Mora: 1000, Primogem: 160 }),
    )
    expect(summary(rows)).toEqual([
      ["Mora", 1500, 500],
      ["Primogem", 160, 0],
    ])
  })

  it("adds what was used up with 0, and counts what is new from 0", () => {
    const rows = materialRows(leyline({ Mora: 10, Primogem: 0 }), leyline({ HerosWit: 3 }))
    expect(summary(rows)).toEqual([
      ["Mora", 10, 10],
      ["HerosWit", 0, -3],
    ])
  })

  it("against a GOOD file, has changes only for what that file lists", () => {
    const rows = materialRows(leyline({ Mora: 10, HerosWit: 2 }), good({ Mora: 4 }))
    expect(summary(rows)).toEqual([
      ["Mora", 10, 6],
      ["HerosWit", 2, undefined],
    ])
  })

  it("for a GOOD file, adds nothing as used up", () => {
    const rows = materialRows(good({ Mora: 10 }), leyline({ Mora: 4, HerosWit: 3 }))
    expect(summary(rows)).toEqual([["Mora", 10, 6]])
  })

  it("has no changes without a previous snapshot", () => {
    const rows = materialRows(leyline({ Mora: 10, HerosWit: 0 }), null)
    expect(summary(rows)).toEqual([["Mora", 10, undefined]])
  })

  it("lists nothing for an account without materials", () => {
    expect(materialRows(good({}), leyline({ Mora: 10 }))).toEqual([])
  })

  it("names unknown keys as not in the data, with no type", () => {
    const [only] = materialRows(leyline({ FakeMaterial: 1 }), null)
    expect(only?.name).toBe(text.names.unknown("FakeMaterial"))
    expect(only?.type).toBeUndefined()
  })
})

describe("visibleRows", () => {
  const keys = (rows: readonly MaterialRow[], options = all) =>
    visibleRows(rows, options).map(row => row.key)

  it("keeps names containing the query, ignoring case and spaces around it", () => {
    const rows = materialRows(leyline({ Mora: 1, Primogem: 1, FakeMaterial: 1 }), null)
    expect(keys(rows, { ...all, query: ` ${materialData("Mora").name} ` })).toEqual(["Mora"])
    expect(keys(rows, { ...all, query: "FAKEMAT" })).toEqual(["FakeMaterial"])
    expect(keys(rows, { ...all, query: "no such name" })).toEqual([])
  })

  it("with only changed on, drops what did not change", () => {
    const rows = materialRows(
      leyline({ Mora: 5, Primogem: 160, HerosWit: 0 }),
      leyline({ Mora: 1, Primogem: 160, HerosWit: 2 }),
    )
    expect(keys(rows, { ...all, onlyChanged: true })).toEqual(["Mora", "HerosWit"])
  })

  it("with only changed on, drops what has no known change", () => {
    const rows = materialRows(leyline({ Mora: 5, HerosWit: 2 }), good({ Mora: 1 }))
    expect(keys(rows, { ...all, onlyChanged: true })).toEqual(["Mora"])
  })
})

describe("tabCounts", () => {
  const rows = materialRows(
    leyline({ Mora: 5, Primogem: 160, HerosWit: 0, CallaLily: 2, CorLapis: 4 }),
    leyline({ Mora: 1, Primogem: 160, HerosWit: 2, CallaLily: 2, CorLapis: 4 }),
  )
  const counts = (options = all) => Object.fromEntries(tabCounts(visibleRows(rows, options)))

  it("counts every tab, with 0 for a tab without rows", () => {
    expect(counts()).toEqual({
      develop: 1,
      currency: 2,
      specialty: 2,
      food: 0,
      material: 0,
      item: 0,
      other: 0,
    })
  })

  it("counts only the rows the filters keep", () => {
    expect(counts({ ...all, onlyChanged: true })).toMatchObject({
      develop: 1,
      currency: 1,
      specialty: 0,
    })
    expect(counts({ ...all, query: materialData("CallaLily").name })).toMatchObject({
      develop: 0,
      currency: 0,
      specialty: 1,
    })
  })
})

describe("tabGroups", () => {
  const held = (...keys: string[]) =>
    materialRows(leyline(Object.fromEntries(keys.map(key => [key, 1]))), null)
  const groupKeys = (rows: readonly MaterialRow[], tab: MaterialTab) =>
    tabGroups(rows, tab).map(group => group.rows.map(row => row.key))

  it("puts each material under its type's tab, and a material without a type under other", () => {
    const rows = held(
      "FakeMaterial",
      "1000YearsOfLoneliness",
      "AMiniTrolleyProblem",
      "AbidingAngelfish",
      "ABuoyantBreeze",
      "CallaLily",
      "Mora",
      "HerosWit",
    )
    expect(MATERIAL_TABS.map(tab => groupKeys(rows, tab).flat())).toEqual([
      ["HerosWit"],
      ["Mora"],
      ["CallaLily"],
      ["ABuoyantBreeze"],
      ["AbidingAngelfish"],
      ["AMiniTrolleyProblem"],
      ["1000YearsOfLoneliness", "FakeMaterial"],
    ])
  })

  it("orders a tab's types as the table lists them, each with its name as the heading", () => {
    const rows = held("CrownOfInsight", "AgnidusAgateChunk", "MysticEnhancementOre", "HerosWit")
    const groups = tabGroups(rows, "develop")
    expect(groups.map(group => group.rows.map(row => row.key))).toEqual([
      ["HerosWit"],
      ["MysticEnhancementOre"],
      ["AgnidusAgateChunk"],
      ["CrownOfInsight"],
    ])
    expect(groups.map(group => group.title)).toEqual(
      ["HerosWit", "MysticEnhancementOre", "AgnidusAgateChunk", "CrownOfInsight"].map(
        key => materialData(key).type,
      ),
    )
  })

  it("orders the specialties by the order the regions came out", () => {
    const rows = held("AmakumoFruit", "CorLapis", "CallaLily")
    expect(groupKeys(rows, "specialty")).toEqual([["CallaLily"], ["CorLapis"], ["AmakumoFruit"]])
  })

  it("under other, puts listed types first, then the rest, then materials without a type", () => {
    const rows = held(
      "FakeMaterial",
      "AlbedosStellaFortuna",
      "AdventureTreasurePack",
      "AinosToolbox",
      "1000YearsOfLoneliness",
    )
    const groups = tabGroups(rows, "other")
    expect(groups.map(group => group.rows.map(row => row.key))).toEqual([
      ["1000YearsOfLoneliness"],
      ["AinosToolbox"],
      ["AdventureTreasurePack"],
      ["AlbedosStellaFortuna"],
      ["FakeMaterial"],
    ])
    expect(groups.at(-1)?.title).toBe(text.materials.noType)
  })

  it("orders a group by rarity, highest first, then by name", () => {
    const rows = held("WanderersAdvice", "AdventurersExperience", "HerosWit")
    expect(groupKeys(rows, "develop")).toEqual([
      ["HerosWit", "AdventurersExperience", "WanderersAdvice"],
    ])
  })

  it("shows the currency tab as one block without a heading, Mora first", () => {
    const rows = held(
      "OriginalResin",
      "AcquaintFate",
      "IntertwinedFate",
      "RealmCurrency",
      "Primogem",
      "GenesisCrystal",
      "Mora",
    )
    const groups = tabGroups(rows, "currency")
    expect(groups).toHaveLength(1)
    expect(groups[0]?.title).toBeUndefined()
    expect(groupKeys(rows, "currency")).toEqual([
      [
        "Mora",
        "GenesisCrystal",
        "Primogem",
        "RealmCurrency",
        "IntertwinedFate",
        "AcquaintFate",
        "OriginalResin",
      ],
    ])
  })

  it("has no blocks for a tab without rows", () => {
    expect(tabGroups(held("Mora"), "food")).toEqual([])
    expect(tabGroups(held("HerosWit"), "currency")).toEqual([])
  })
})

describe("takeRows", () => {
  const row = (key: string) => ({ key }) as MaterialRow
  const groups = [
    { title: "FakeTypeA", rows: [row("FakeA1"), row("FakeA2")] },
    { title: "FakeTypeB", rows: [row("FakeB1"), row("FakeB2")] },
  ]
  const keys = (count: number) =>
    takeRows(groups, count).map(({ group, rows }) => [group.title, rows.map(r => r.key)])

  it("cuts the last group it reaches and leaves out the ones after it", () => {
    expect(keys(3)).toEqual([
      ["FakeTypeA", ["FakeA1", "FakeA2"]],
      ["FakeTypeB", ["FakeB1"]],
    ])
    expect(keys(2)).toEqual([["FakeTypeA", ["FakeA1", "FakeA2"]]])
  })

  it("gives every row when the count covers them all", () => {
    expect(keys(10).flatMap(([, rows]) => rows)).toHaveLength(4)
  })
})
