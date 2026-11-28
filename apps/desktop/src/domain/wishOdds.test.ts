// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import {
  chanceWithin,
  characterArrivals,
  LOSE,
  meanWishes,
  refundPerWish,
  STRATEGIES,
  strategySteps,
  weaponArrivals,
} from "./wishOdds"

const fresh = { pity: 0, guaranteed: false, radiance: 0 }

describe("wish odds", () => {
  it("wins a 50/50 half the time, and always after three lost in a row", () => {
    expect(LOSE).toBe(0.5)
    const sure = characterArrivals({ pity: 0, guaranteed: true, radiance: 0 }, 1)
    const three = characterArrivals({ pity: 0, guaranteed: false, radiance: 3 }, 1)
    expect(three.mean[0]).toBeCloseTo(sure.mean[0] ?? 0, 8)
    const two = characterArrivals({ pity: 0, guaranteed: false, radiance: 2 }, 1)
    expect(two.mean[0]).toBeCloseTo((sure.mean[0] ?? 0) * 1.5, 4)
  })

  it("adds up to one and takes the known average for a five-star", () => {
    const sure = characterArrivals({ pity: 0, guaranteed: true, radiance: 0 }, 1)
    const total = sure.pmf[0]?.reduce((sum, p) => sum + p, 0) ?? 0
    expect(total).toBeCloseTo(1, 8)
    expect(sure.mean[0]).toBeGreaterThan(61.5)
    expect(sure.mean[0]).toBeLessThan(63)
    const open = characterArrivals(fresh, 1)
    expect(open.mean[0]).toBeCloseTo((sure.mean[0] ?? 0) * (1 + LOSE), 4)
  })

  it("is certain at hard pity, and after three lost 50/50s", () => {
    const last = characterArrivals({ pity: 89, guaranteed: false, radiance: 3 }, 1)
    expect(last.pmf[0]?.[1]).toBeCloseTo(1, 12)
    const weapon = weaponArrivals({ pity: 79, guaranteed: false, fate: 1 }, 1)
    expect(weapon.pmf[0]?.[1]).toBeCloseTo(1, 12)
  })

  it("adds the two banners' wishes", () => {
    const c = characterArrivals(fresh, 2)
    const w = weaponArrivals({ pity: 0, guaranteed: false, fate: 0 }, 1)
    expect(chanceWithin(c, 0, w, 0, 0)).toBe(1)
    expect(chanceWithin(c, 1, w, 0, 0)).toBe(0)
    expect(chanceWithin(c, 2, w, 1, 100_000)).toBeCloseTo(1, 6)
    const half = chanceWithin(c, 1, w, 1, 200)
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(chanceWithin(c, 1, w, 0, 200))
    expect(meanWishes(c, 1, w, 1)).toBeCloseTo((c.mean[0] ?? 0) + (w.mean[0] ?? 0), 8)
  })

  it("orders a strategy's steps", () => {
    expect(strategySteps(0).slice(0, 3)).toEqual([
      { characters: 1, weapons: 0 },
      { characters: 1, weapons: 1 },
      { characters: 2, weapons: 1 },
    ])
    expect(strategySteps("weapon")[0]).toEqual({ characters: 0, weapons: 1 })
    for (const strategy of STRATEGIES) {
      expect(strategySteps(strategy).at(-1)).toEqual({ characters: 7, weapons: 5 })
    }
    expect(strategySteps(0)).toHaveLength(12)
  })

  it("gives back about half a Starglitter a wish on a character banner", () => {
    expect(refundPerWish(18 / 26).starglitter).toBeCloseTo(0.504, 3)
  })
})
