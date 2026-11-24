// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * What the overview's resin plan draws on. Stygian Onslaught's burst
 * is the first ten game days of a season: the resin spent on its
 * ley line flowers claims an artifact domain's rewards and counts toward the
 * season's extra rewards.
 */

import type { Account } from "@/domain/account"
import { gameDay, gameDayStart } from "@/domain/gameTime"
import { STYGIAN_SEASONS, type StygianSeason } from "@/domain/overviewData"

const BURST_DAYS = 10
/** The Adventure Rank the burst needs. */
const BURST_AR = 45
/** The training event, whose daily goal counts the Original Resin spent, Condensed Resin not. */
const TRAINING_EVENT = 5294
const TRAINING_GOAL = 120
/** The resin items, in the game's order. */
const RESIN_ITEMS = ["CondensedResin", "FragileResin", "TransientResin"] as const

/** How to spend resin during the burst: all on its artifacts, or 1200 for its prestige reward. */
export const BURST_MODES = ["all", "prestige"] as const
export type BurstMode = (typeof BURST_MODES)[number]

export type Burst = { season: number; start: number; end: number }

/** A season's burst: its first ten game days; none when its start is not known. */
export function burstOf({ season, begin }: StygianSeason): Burst | undefined {
  return begin === undefined
    ? undefined
    : { season, start: begin, end: gameDayStart(gameDay(begin) + BURST_DAYS) }
}

const BURSTS = STYGIAN_SEASONS.flatMap(season => burstOf(season) ?? []).sort(
  (a, b) => a.start - b.start,
)

/** The burst running at `now`, if one is. */
export function currentBurst(now: number, bursts: readonly Burst[] = BURSTS) {
  return bursts.find(burst => burst.start <= now && now < burst.end)
}

/** The burst running at `now`, when the account can take part in it. */
export function burstFor(account: Account, now: number) {
  const ar = account.player?.ar
  return ar !== undefined && ar >= BURST_AR ? currentBurst(now) : undefined
}

export type ResinState = {
  /** The resin items held, those there are any of. */
  items: { key: string; count: number }[]
  /** The training event's Original Resin spent today, while it runs and the snapshot counts it. */
  training?: { spent: number; goal: number }
}

/** The resin items there are to spend now, and what the training event still asks of today. */
export function resinState(account: Account, now: number): ResinState {
  const { tasks, events, materials } = account
  const items = RESIN_ITEMS.flatMap(key => {
    const count = materials.get(key) ?? 0
    return count > 0 ? [{ key, count }] : []
  })
  const running = events?.some(e => e.id === TRAINING_EVENT && e.start <= now && now < e.end)
  const spent = tasks?.resinSpent
  // What was spent on an earlier game day is today's 0.
  const today = spent && gameDay(spent.at) === gameDay(now) ? spent.value : 0
  return {
    items,
    training: running && spent ? { spent: today, goal: TRAINING_GOAL } : undefined,
  }
}
