// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Weapon } from "@/domain/good"
import { text } from "@/i18n"
import { visibleWeapons, type WeaponRow, weaponCounts, weaponRows } from "./order"

const weapon = (key: string, location = ""): Weapon => ({
  key,
  level: 1,
  ascension: 0,
  refinement: 1,
  location,
  lock: false,
})

type Fields = Partial<Pick<Weapon, "key" | "level" | "refinement" | "location">> &
  Pick<WeaponRow, "rarity" | "type">

let nextId = 0
function row(name: string, fields: Fields): WeaponRow {
  const { key = `Fake${name}`, level = 1, refinement = 1, location = "", ...rest } = fields
  return { id: nextId++, weapon: { ...weapon(key, location), level, refinement }, name, ...rest }
}

const names = (rows: WeaponRow[]) => rows.map(r => r.name)
const all = { type: null, onlyFree: false, sort: "rarity" } as const

describe("weaponRows", () => {
  it("names unknown keys as not in the data and gives them no rarity or type", () => {
    const [only] = weaponRows([weapon("FakeBlade")])
    expect(only?.name).toBe(text.names.unknown("FakeBlade"))
    expect(only?.rarity).toBeUndefined()
    expect(only?.type).toBeUndefined()
  })

  it("names the wielder, any Traveler as the Traveler, and no one when unequipped", () => {
    const rows = weaponRows([
      weapon("FakeA", "FakeHero"),
      weapon("FakeB", "Traveler"),
      weapon("FakeC"),
    ])
    expect(rows.map(r => r.wielder?.name)).toEqual([
      text.names.unknown("FakeHero"),
      text.names.traveler,
      undefined,
    ])
  })

  it("gives the wielder's icon when the data has one, and none for the Traveler", () => {
    const [known, traveler] = weaponRows([weapon("FakeA", "Bennett"), weapon("FakeB", "Traveler")])
    expect(known?.wielder?.icon).toEqual(expect.any(String))
    expect(traveler?.wielder?.icon).toBeUndefined()
  })

  it("numbers the rows in the export's order", () => {
    expect(weaponRows([weapon("FakeA"), weapon("FakeA")]).map(r => r.id)).toEqual([0, 1])
  })
})

describe("weaponCounts", () => {
  it("counts all, five stars, four stars and equipped weapons", () => {
    const rows = [
      row("A", { rarity: 5, location: "FakeHero" }),
      row("B", { rarity: 4 }),
      row("C", { rarity: 4, location: "FakeOther" }),
      row("D", { rarity: 3 }),
      row("E", {}),
    ]
    expect(weaponCounts(rows)).toEqual({ total: 5, five: 1, four: 2, equipped: 2 })
  })
})

describe("visibleWeapons", () => {
  it("keeps only the chosen type", () => {
    const rows = [row("A", { type: "sword" }), row("B", { type: "bow" }), row("C", {})]
    expect(names(visibleWeapons(rows, { ...all, type: "bow" }))).toEqual(["B"])
  })

  it("keeps only unequipped weapons when asked", () => {
    const rows = [row("A", { location: "FakeHero" }), row("B", {})]
    expect(names(visibleWeapons(rows, { ...all, onlyFree: true }))).toEqual(["B"])
  })

  it("sorts by rarity, then level, then refinement, highest first", () => {
    const rows = [
      row("A", { rarity: 4, level: 90, refinement: 5 }),
      row("B", { rarity: 5, level: 20 }),
      row("C", { rarity: 4, level: 90, refinement: 1 }),
      row("D", { level: 90 }),
    ]
    expect(names(visibleWeapons(rows, all))).toEqual(["B", "A", "C", "D"])
  })

  it("sorts by level, then rarity, then refinement", () => {
    const rows = [
      row("A", { rarity: 4, level: 80, refinement: 5 }),
      row("B", { rarity: 5, level: 80 }),
      row("C", { rarity: 4, level: 90 }),
      row("D", { rarity: 4, level: 80, refinement: 2 }),
    ]
    expect(names(visibleWeapons(rows, { ...all, sort: "level" }))).toEqual(["C", "B", "A", "D"])
  })

  it("sorts by refinement, then rarity, then level", () => {
    const rows = [
      row("A", { rarity: 4, refinement: 5, level: 1 }),
      row("B", { rarity: 5, refinement: 1 }),
      row("C", { rarity: 4, refinement: 5, level: 90 }),
      row("D", { rarity: 5, refinement: 5 }),
    ]
    expect(names(visibleWeapons(rows, { ...all, sort: "refinement" }))).toEqual([
      "D",
      "C",
      "A",
      "B",
    ])
  })

  it("breaks full ties by name and then by key", () => {
    const rows = [row("B", {}), row("A", { key: "FakeZ" }), row("A", {})]
    expect(visibleWeapons(rows, all).map(r => [r.name, r.weapon.key])).toEqual([
      ["A", "FakeA"],
      ["A", "FakeZ"],
      ["B", "FakeB"],
    ])
  })

  it("leaves the given rows in their order", () => {
    const rows = [row("B", {}), row("A", {})]
    visibleWeapons(rows, all)
    expect(names(rows)).toEqual(["B", "A"])
  })
})
