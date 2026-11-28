// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * An account's wish history worked out: each banner's pity, the 50/50s won
 * and lost, Capturing Radiance's count, and how each past event banner went.
 * Records are stored oldest first; a record's place in the pity counts comes
 * from that order (the game's ids grow with each wish).
 */

import { wishes as data } from "@/domain/gameData"

export type WishRecord = {
  /** The game's record id, as text: it does not fit a number. */
  id: string
  gachaType: number
  /** 0 when the source named none. */
  itemId: number
  rank: number
  /** Unix milliseconds. */
  time: number
  /** As the source wrote it, for an item the bundled data does not know. */
  name: string
}

export const POOLS = ["character", "weapon", "chronicled", "standard", "novice"] as const
export type PoolKey = (typeof POOLS)[number]

/** The banner type each pool's records carry; the character event's second banner is 400. */
const POOL_OF: Record<number, PoolKey> = {
  301: "character",
  400: "character",
  302: "weapon",
  500: "chronicled",
  200: "standard",
  100: "novice",
}

/** Wishes to a guaranteed five-star; the novice wish ends after 20. */
export const HARD_PITY: Record<PoolKey, number> = {
  character: 90,
  weapon: 80,
  chronicled: 90,
  standard: 90,
  novice: 20,
}

/** Capturing Radiance starts with 5.0 (2024-08-28): records before it do not count. */
export const RADIANCE_FROM = Date.UTC(2024, 7, 27, 22)
/** Three 50/50s lost in a row, and the next one is won by Capturing Radiance. */
export const RADIANCE_LIMIT = 3

/** What a five-star of an event banner was: a 50/50 won, the featured one after a lost 50/50, a 50/50 lost, or won by Capturing Radiance. */
export type Tag = "won" | "guaranteed" | "lost" | "radiance"

export type Banner = {
  name: string
  version: string
  /** 1 the version's first half, 2 (and for 1.3, 3) the second. */
  phase: number
  from: number
  to: number
  type: number
  up5: number[]
  up4: number[]
}

export const BANNERS: readonly Banner[] = data.banners
const STANDARD = new Set<number>(data.standard)
const ITEMS: Record<string, string> = data.items

/** Every item id the bundled data knows. */
export const ITEM_IDS: readonly number[] = Object.keys(ITEMS).map(Number)

/** What an item id is, as a GOOD key: undefined for one the bundled data does not know. */
export function itemOf(
  itemId: number,
): { kind: "characters" | "weapons"; key: string } | undefined {
  const item = ITEMS[itemId]
  if (item === undefined) return undefined
  return { kind: item.startsWith("c:") ? "characters" : "weapons", key: item.slice(2) }
}

export const isStandard = (itemId: number) => STANDARD.has(itemId)

/** Orders record ids, which are numbers too large for a JS number. */
export function compareIds(a: string, b: string) {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)
}

export function poolOf(gachaType: number): PoolKey | undefined {
  return POOL_OF[gachaType]
}

/** The event banner a record was wished on, by its type and time. */
export function bannerOf(record: WishRecord): Banner | undefined {
  return BANNERS.find(
    banner =>
      banner.type === record.gachaType && banner.from <= record.time && record.time <= banner.to,
  )
}

/** A record in its pool, with its place in the pity counts. */
export type Pull = WishRecord & {
  pool: PoolKey
  /** For a four- or five-star: the wishes since the pool's previous one of its rank, itself included. */
  pity: number
  tag?: Tag
}

export type PoolSummary = {
  key: PoolKey
  total: number
  first?: number
  last?: number
  /** Wishes since the last five-star (the novice wish: wishes made). */
  pity: number
  pity4: number
  /** The next five-star is the featured one: the last was not. */
  guaranteed: boolean
  /** Capturing Radiance's count: 50/50s lost in a row (character event only). */
  radiance: number
  /** Newest first. */
  fives: Pull[]
  fours: Pull[]
  /** The five-stars' average pity, and wishes per featured five-star. */
  average?: number
  averageUp?: number
}

/** Each pool's records with their pity counts and tags, oldest first. */
export function pullsByPool(records: readonly WishRecord[]): Record<PoolKey, Pull[]> {
  const pulls: Record<PoolKey, Pull[]> = {
    character: [],
    weapon: [],
    chronicled: [],
    standard: [],
    novice: [],
  }
  const since: Record<PoolKey, { 4: number; 5: number }> = {
    character: { 4: 0, 5: 0 },
    weapon: { 4: 0, 5: 0 },
    chronicled: { 4: 0, 5: 0 },
    standard: { 4: 0, 5: 0 },
    novice: { 4: 0, 5: 0 },
  }
  const guaranteed: Record<PoolKey, boolean> = {
    character: false,
    weapon: false,
    chronicled: false,
    standard: false,
    novice: false,
  }
  let radiance = 0
  for (const record of records) {
    const pool = poolOf(record.gachaType)
    if (pool === undefined) continue
    const count = since[pool]
    count[4]++
    count[5]++
    const pull: Pull = { ...record, pool, pity: 0 }
    if (record.rank === 4) {
      pull.pity = count[4]
      count[4] = 0
    } else if (record.rank === 5) {
      pull.pity = count[5]
      count[5] = 0
      if (pool === "character" || pool === "weapon") {
        const banner = bannerOf(record)
        // A banner newer than the bundled data: anything not standard was featured.
        const up = banner ? banner.up5.includes(record.itemId) : !isStandard(record.itemId)
        const counted = pool === "character" && record.time >= RADIANCE_FROM
        if (guaranteed[pool]) {
          pull.tag = "guaranteed"
          guaranteed[pool] = !up
        } else if (up) {
          pull.tag = counted && radiance >= RADIANCE_LIMIT ? "radiance" : "won"
          if (counted) radiance = 0
        } else {
          pull.tag = "lost"
          guaranteed[pool] = true
          if (counted) radiance++
        }
      }
    }
    pulls[pool].push(pull)
  }
  return pulls
}

export function summarize(key: PoolKey, pulls: readonly Pull[]): PoolSummary {
  let pity = 0
  let pity4 = 0
  for (const pull of pulls) {
    pity = pull.rank === 5 ? 0 : pity + 1
    pity4 = pull.rank >= 4 ? 0 : pity4 + 1
  }
  if (key === "novice") pity = pulls.length
  const fives = pulls.filter(pull => pull.rank === 5)
  const ups = fives.filter(pull => pull.tag !== "lost")
  const lastUp = pulls.findLastIndex(pull => pull.rank === 5 && pull.tag !== "lost")
  const last5 = fives.at(-1)
  let radiance = 0
  if (key === "character") {
    for (const pull of fives) {
      if (pull.time < RADIANCE_FROM || pull.tag === "guaranteed") continue
      radiance = pull.tag === "lost" ? radiance + 1 : 0
    }
  }
  return {
    key,
    total: pulls.length,
    first: pulls[0]?.time,
    last: pulls.at(-1)?.time,
    pity,
    pity4,
    guaranteed: last5?.tag === "lost",
    radiance: Math.min(radiance, RADIANCE_LIMIT),
    fives: fives.toReversed(),
    fours: pulls.filter(pull => pull.rank === 4).toReversed(),
    average:
      fives.length > 0 ? fives.reduce((sum, pull) => sum + pull.pity, 0) / fives.length : undefined,
    averageUp:
      (key === "character" || key === "weapon") && ups.length > 0
        ? (lastUp + 1) / ups.length
        : undefined,
  }
}

/** Every pool's summary, in `POOLS` order. */
export function summarizeAll(records: readonly WishRecord[]): PoolSummary[] {
  const pulls = pullsByPool(records)
  return POOLS.map(key => summarize(key, pulls[key]))
}

/** How lucky a five-star was: its pity against the hard pity. */
export type Luck = "good" | "fair" | "bad"

export function luckOf(pity: number, of: number): Luck {
  const share = pity / of
  return share <= 0.67 ? "good" : share <= 0.84 ? "fair" : "bad"
}

/** An event banner's wishes, as the past banners page shows it. */
export type BannerPulls = {
  banner: Banner
  pulls: number
  fours: number
  /** Newest first. */
  fives: Pull[]
  /** The pity carried to the next banner when it gave no five-star. */
  carried: number
  gotUp: boolean
}

/**
 * Each event banner's wishes, newest banner first. The character event's two
 * banners at a time are told apart by the records' type.
 */
export function bannerPulls(records: readonly WishRecord[]): BannerPulls[] {
  const pulls = pullsByPool(records)
  return BANNERS.map(banner => {
    const pool = poolOf(banner.type)
    const mine = (pool ? pulls[pool] : []).filter(
      pull => pull.gachaType === banner.type && banner.from <= pull.time && pull.time <= banner.to,
    )
    const fives = mine.filter(pull => pull.rank === 5)
    let carried = 0
    const lastPull = mine.at(-1)
    if (lastPull && pool) {
      const all = pulls[pool]
      const end = all.indexOf(lastPull)
      for (let i = end; i >= 0 && all[i]?.rank !== 5; i--) carried++
    }
    return {
      banner,
      pulls: mine.length,
      fours: mine.filter(pull => pull.rank === 4).length,
      fives: fives.toReversed(),
      carried,
      gotUp: fives.some(pull => banner.up5.includes(pull.itemId)),
    }
  }).toReversed()
}

/** The versions in the banner data, oldest first. */
export const VERSIONS: readonly string[] = [...new Set(BANNERS.map(banner => banner.version))]

/** The latest version, and whether its second half's banners are known yet. */
export function latestVersion() {
  const version = VERSIONS.at(-1) ?? ""
  const second = BANNERS.some(banner => banner.version === version && banner.phase >= 2)
  return { version, second }
}

/** A featured item's history: the banners (version index, half) it was featured on. */
export type Featured = {
  itemId: number
  kind: "characters" | "weapons"
  rank: 4 | 5
  /** Version index (into VERSIONS) and half (0 first, 1 second), oldest first. */
  times: { version: number; half: 0 | 1 }[]
  standard: boolean
}

/** Every item featured on a character or weapon event banner, the chronicled wish aside. */
export function featuredHistory(): Featured[] {
  const byItem = new Map<number, Featured>()
  for (const banner of BANNERS) {
    if (banner.type === 500) continue
    const version = VERSIONS.indexOf(banner.version)
    const half = banner.phase >= 2 ? 1 : 0
    for (const [rank, list] of [
      [5, banner.up5],
      [4, banner.up4],
    ] as const) {
      for (const itemId of list) {
        const item = itemOf(itemId)
        if (!item) continue
        let entry = byItem.get(itemId)
        if (!entry) {
          entry = { itemId, kind: item.kind, rank, times: [], standard: isStandard(itemId) }
          byItem.set(itemId, entry)
        }
        if (!entry.times.some(t => t.version === version && t.half === half)) {
          entry.times.push({ version, half })
        }
      }
    }
  }
  return [...byItem.values()]
}
