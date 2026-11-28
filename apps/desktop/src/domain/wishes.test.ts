// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import {
  BANNERS,
  bannerPulls,
  featuredHistory,
  isStandard,
  itemOf,
  latestVersion,
  pullsByPool,
  RADIANCE_FROM,
  summarize,
  summarizeAll,
  type WishRecord,
} from "./wishes"

// A character banner after 5.0 with one featured five-star, and a standard five-star character.
const banner = BANNERS.find(
  b => b.type === 301 && b.from > RADIANCE_FROM + 100 * 86_400_000 && b.up5.length === 1,
)
const standard = [10000016, 10000003, 10000041].find(isStandard)
if (!banner || standard === undefined) throw new Error("the bundled data has no such banner")
const featured = banner.up5[0] ?? 0

let nextId = 1
/** `filler` three-stars and then one of `rank`, on `gachaType` within the banner. */
function wishes(filler: number, rank: number, itemId: number, gachaType = 301): WishRecord[] {
  const list: WishRecord[] = []
  for (let i = 0; i <= filler; i++) {
    const last = i === filler
    list.push({
      id: String(nextId++),
      gachaType,
      itemId: last ? itemId : 11301,
      rank: last ? rank : 3,
      time: banner?.from ?? 0,
      name: "",
    })
  }
  return list
}

describe("wish pools", () => {
  it("counts pity per pool and rank, and tags a lost 50/50 and its guarantee", () => {
    const records = [
      ...wishes(9, 4, 11401),
      ...wishes(60, 5, standard),
      ...wishes(5, 4, 11402, 200),
      ...wishes(20, 5, featured, 400),
    ]
    const pulls = pullsByPool(records)
    const fives = pulls.character.filter(p => p.rank === 5)
    expect(fives.map(p => [p.pity, p.tag])).toEqual([
      [71, "lost"],
      [21, "guaranteed"],
    ])
    expect(pulls.character.find(p => p.rank === 4)?.pity).toBe(10)
    expect(pulls.standard.find(p => p.rank === 4)?.pity).toBe(6)
    const summary = summarize("character", pulls.character)
    expect(summary.total).toBe(92)
    expect(summary.pity).toBe(0)
    expect(summary.guaranteed).toBe(false)
    expect(summary.radiance).toBe(1)
    expect(summary.average).toBe(46)
    expect(summary.averageUp).toBe(92)
  })

  it("wins the 50/50 by Capturing Radiance after three lost in a row", () => {
    const records = [
      ...wishes(0, 5, standard),
      ...wishes(0, 5, featured),
      ...wishes(0, 5, standard),
      ...wishes(0, 5, featured),
      ...wishes(0, 5, standard),
      ...wishes(0, 5, featured),
    ]
    let summary = summarize("character", pullsByPool(records).character)
    expect(summary.radiance).toBe(3)
    expect(summary.guaranteed).toBe(false)
    const tags = pullsByPool([...records, ...wishes(10, 5, featured)]).character.flatMap(p =>
      p.tag ? [p.tag] : [],
    )
    expect(tags).toEqual([
      "lost",
      "guaranteed",
      "lost",
      "guaranteed",
      "lost",
      "guaranteed",
      "radiance",
    ])
    summary = summarize("character", pullsByPool([...records, ...wishes(0, 5, featured)]).character)
    expect(summary.radiance).toBe(0)
  })

  it("a won 50/50 ends the run of lost ones", () => {
    const records = [
      ...wishes(0, 5, standard),
      ...wishes(0, 5, featured),
      ...wishes(0, 5, featured),
      ...wishes(0, 5, standard),
    ]
    const summary = summarize("character", pullsByPool(records).character)
    expect(summary.radiance).toBe(1)
    expect(summary.guaranteed).toBe(true)
  })

  it("lists every pool, the novice wish counting wishes made", () => {
    const all = summarizeAll(wishes(7, 4, 11401, 100))
    expect(all.map(s => s.key)).toEqual(["character", "weapon", "chronicled", "standard", "novice"])
    expect(all[4]?.pity).toBe(8)
    expect(all[0]?.total).toBe(0)
  })

  it("puts each wish on its banner and carries a banner's pity on", () => {
    const records = [...wishes(30, 3, 11301)]
    const own = bannerPulls(records).find(b => b.banner === banner)
    expect(own?.pulls).toBe(31)
    expect(own?.carried).toBe(31)
    expect(own?.gotUp).toBe(false)
  })
})

describe("banner data", () => {
  it("knows its items and the latest version", () => {
    expect(itemOf(featured)?.kind).toBe("characters")
    expect(itemOf(standard)?.kind).toBe("characters")
    expect(latestVersion().version).toMatch(/^\d+\.\d+$/)
  })

  it("lists each featured item's banners once per half", () => {
    const history = featuredHistory()
    const item = history.find(h => h.itemId === featured)
    expect(item?.rank).toBe(5)
    const keys = item?.times.map(t => `${t.version}-${t.half}`) ?? []
    expect(new Set(keys).size).toBe(keys.length)
  })
})
