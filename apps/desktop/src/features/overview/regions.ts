// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Exploration } from "@/domain/account"
import { CITIES, type City, cityExploration } from "@/domain/overviewData"
import { text } from "@/text/zh"

export type RegionTile = {
  id: number
  name: string
  /** Explored share from 0 to 1; null when the file has no points for the city. */
  fraction: number | null
  /** Statue and reputation levels. */
  levels: string
  /** The city's offerings with their levels, or that it has none. */
  offerings: string
}

/** "97.2%", rounded down so that only a fully explored city reads 100%. */
export function formatExploration(fraction: number | null) {
  if (fraction === null) return text.regions.unknownPercent
  if (fraction >= 1) return "100%"
  return `${(Math.floor(fraction * 1000) / 10).toFixed(1)}%`
}

/** The city's offerings and their levels; Leyline also lists those still at level 0, left out here. */
export function offeringsLine(city: City, levels: ReadonlyMap<number, number>) {
  const parts = city.offerings.flatMap(offering => {
    const level = levels.get(offering.id) ?? 0
    return level > 0 ? [text.regions.offering(offering.name, level)] : []
  })
  return parts.length > 0 ? parts.join(" · ") : text.regions.noOffering
}

/** A tile for each city with a statue, reputation or exploration points, in game order. */
export function regionTiles(exploration: Exploration): RegionTile[] {
  return CITIES.flatMap(city => {
    const statue = exploration.statues.get(city.id) ?? 0
    const reputation = exploration.reputation.get(city.id) ?? 0
    const fraction = exploration.explore ? cityExploration(city.id, exploration.explore) : null
    if (statue === 0 && reputation === 0 && !fraction) return []
    const levels = [text.regions.statue(statue)]
    if (reputation > 0) levels.push(text.regions.reputation(reputation))
    return [
      {
        id: city.id,
        name: city.name,
        fraction,
        levels: levels.join(" · "),
        offerings: offeringsLine(city, exploration.offerings),
      },
    ]
  })
}
