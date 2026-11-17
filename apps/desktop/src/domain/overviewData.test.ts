// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import data from "@/generated/overview.json"
import { ELEMENTS } from "./elements"
import {
  abyssBlessing,
  CITIES,
  cityExploration,
  nameCardPicture,
  profileFrameIcon,
  theaterCast,
  theaterEnd,
} from "./overviewData"

// The table is regenerated with every game version, so the cases are picked from it.
const areas = Object.entries(data.areas).map(([id, area]) => ({ id: Number(id), ...area }))

function areasOf(city: number) {
  return areas.filter(area => area.city === city)
}

/** A city with two or more areas: two of them, the sum of its totals, and another city's area. */
function pickCity() {
  const city = CITIES.find(item => areasOf(item.id).length >= 2)
  const [first, second] = areasOf(city?.id ?? Number.NaN)
  const other = areas.find(area => area.city !== city?.id)
  if (!city || !first || !second || !other) throw new Error("the table lacks such a city")
  return { city: city.id, first, second, other, total: sum(areasOf(city.id)) }
}

function sum(list: { total: number }[]) {
  return list.reduce((total, area) => total + area.total, 0)
}

describe("cityExploration", () => {
  it("caps each area at its total and weights the areas by their totals", () => {
    const { city, first, second, total } = pickCity()
    const explore = new Map([
      [first.id, first.total * 3],
      [second.id, second.total / 2],
    ])
    expect(cityExploration(city, explore)).toBeCloseTo((first.total + second.total / 2) / total)
  })

  it("is complete when every area reports at least its total", () => {
    const { city } = pickCity()
    const explore = new Map(areasOf(city).map(area => [area.id, area.total + 1]))
    expect(cityExploration(city, explore)).toBeCloseTo(1)
  })

  it("counts an area reported with zero points", () => {
    const { city, first } = pickCity()
    expect(cityExploration(city, new Map([[first.id, 0]]))).toBe(0)
  })

  it("is null when no area of the city has points", () => {
    const { city, other } = pickCity()
    expect(cityExploration(city, new Map())).toBeNull()
    expect(cityExploration(city, new Map([[other.id, other.total]]))).toBeNull()
    expect(cityExploration(-1, new Map([[other.id, other.total]]))).toBeNull()
  })
})

describe("CITIES", () => {
  it("lists every city of the table in id order", () => {
    const ids = CITIES.map(city => city.id)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    expect(ids.length).toBe(Object.keys(data.cities).length)
  })

  it("names every offering a city lists from the table", () => {
    const names: Record<string, string> = data.offerings
    for (const city of CITIES) {
      for (const offering of city.offerings) {
        expect(names[String(offering.id)]).toBeDefined()
        expect(offering.name).toBe(names[String(offering.id)])
      }
    }
  })
})

describe("season ends", () => {
  it("are in milliseconds, and missing for a season the table does not know", () => {
    const [season, end] = Object.entries(data.theater)[0] ?? []
    expect(theaterEnd(Number(season))).toBe(Number(end) * 1000)
    expect(theaterEnd(-1)).toBeUndefined()
  })
})

describe("profile frames and name cards", () => {
  it("draw no frame for the default one or an unknown id", () => {
    const [id, icon] = Object.entries(data.profileFrames)[0] ?? []
    expect(profileFrameIcon(Number(id))).toBe(icon)
    expect(profileFrameIcon(100000)).toBeUndefined()
    expect(profileFrameIcon(-1)).toBeUndefined()
  })

  it("give each name card its wide art", () => {
    const [id] = Object.keys(data.nameCards)
    expect(nameCardPicture(Number(id))).toMatch(/^UI_NameCardPic_\w+_P$/)
    expect(nameCardPicture(-1)).toBeUndefined()
  })
})

describe("theaterCast", () => {
  it("gives element keys and four guests and six openers by character key", () => {
    for (const season of Object.keys(data.theaterCasts)) {
      const cast = theaterCast(Number(season))
      expect(cast?.elements.length).toBeGreaterThan(0)
      expect(cast?.elements.every(element => ELEMENTS.includes(element))).toBe(true)
      expect(cast?.guests.length).toBe(4)
      expect(cast?.openers.length).toBe(6)
    }
    expect(theaterCast(-1)).toBeUndefined()
  })
})

describe("abyssBlessing", () => {
  it("is the blessing of the period that opened at the start, in milliseconds", () => {
    const blessings: Record<string, { name: string; text: string }> = data.abyssBlessings
    const [season, open] = Object.entries(data.abyss).at(-1) ?? []
    expect(abyssBlessing(Number(open) * 1000)).toEqual(blessings[String(season)])
    expect(abyssBlessing(Number(open))).toBeUndefined()
  })

  it("has the text without the game's markup", () => {
    for (const { name, text } of Object.values(data.abyssBlessings)) {
      expect(name).not.toBe("")
      expect(text).not.toMatch(/[<>]/)
    }
  })
})
