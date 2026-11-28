// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Exploration } from "@/domain/account"
import { CITIES, type City, cityExploration } from "@/domain/overviewData"
import data from "@/generated/overview.json"
import { text } from "@/text"
import { formatExploration, offeringsLine, regionTiles } from "./regions"

const exploration = (parts: Partial<Exploration>): Exploration => ({
  statues: new Map(),
  reputation: new Map(),
  offerings: new Map(),
  ...parts,
})

describe("formatExploration", () => {
  it("shows one decimal, rounded down", () => {
    expect(formatExploration(0.972)).toBe("97.2%")
    expect(formatExploration(0.5)).toBe("50.0%")
    expect(formatExploration(0)).toBe("0.0%")
  })

  it("reads 100% only when fully explored", () => {
    expect(formatExploration(1)).toBe("100%")
    expect(formatExploration(0.9999)).toBe("99.9%")
  })

  it("shows a dash when the share is unknown", () => {
    expect(formatExploration(null)).toBe(text.regions.unknownPercent)
  })
})

describe("offeringsLine", () => {
  const city: City = {
    id: 900,
    name: "Fake City",
    offerings: [
      { id: 901, name: "Fake Tree" },
      { id: 902, name: "Fake Spring" },
      { id: 903, name: "Fake Shrine" },
    ],
  }

  it("lists the offerings above level 0 in the city's order", () => {
    const levels = new Map([
      [903, 4],
      [901, 12],
      [902, 0],
    ])
    expect(offeringsLine(city, levels)).toBe(
      `${text.regions.offering("Fake Tree", 12)} · ${text.regions.offering("Fake Shrine", 4)}`,
    )
  })

  it("says there is no offering when none is unlocked", () => {
    expect(offeringsLine(city, new Map([[901, 0]]))).toBe(text.regions.noOffering)
    expect(offeringsLine({ ...city, offerings: [] }, new Map())).toBe(text.regions.noOffering)
  })
})

describe("regionTiles", () => {
  const first = CITIES[0]
  const area = Number(Object.entries(data.areas).find(([, a]) => a.city === first?.id)?.[0])

  it("leaves out cities without a statue, reputation or points", () => {
    expect(regionTiles(exploration({}))).toEqual([])
    expect(
      regionTiles(
        exploration({ statues: new Map([[first?.id ?? 0, 0]]), explore: new Map([[area, 0]]) }),
      ),
    ).toEqual([])
  })

  it("shows a city with exploration points only, its share from those points", () => {
    const explore = new Map([[area, 1]])
    const tiles = regionTiles(exploration({ explore }))
    expect(tiles).toHaveLength(1)
    expect(tiles[0]).toMatchObject({
      id: first?.id,
      fraction: cityExploration(first?.id ?? 0, explore),
      levels: text.regions.statue(0),
    })
    expect(tiles[0]?.fraction).toBeGreaterThan(0)
  })

  it("shows a city with a statue only, its share unknown without points", () => {
    const tiles = regionTiles(exploration({ statues: new Map([[first?.id ?? 0, 7]]) }))
    expect(tiles).toHaveLength(1)
    expect(tiles[0]).toMatchObject({
      id: first?.id,
      name: first?.name,
      fraction: null,
      levels: text.regions.statue(7),
    })
  })

  it("adds the reputation level, and statue level 0 when only reputation is known", () => {
    const id = first?.id ?? 0
    const tiles = regionTiles(exploration({ reputation: new Map([[id, 3]]) }))
    expect(tiles[0]?.levels).toBe(`${text.regions.statue(0)} · ${text.regions.reputation(3)}`)
  })
})
