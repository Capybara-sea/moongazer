// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The standing tasks on the overview's to-do card: when each starts over and
 * what the snapshot says of it now. The daily and challenge cards show the
 * rest as they are, without ticks. A snapshot from before the period began
 * says the task is not done yet, since its counts are of an earlier period.
 */

import type { Account } from "@/domain/account"
import {
  lastDailyReset,
  lastMonthlyReset,
  lastWeeklyReset,
  nextMonthlyReset,
  nextWeeklyReset,
} from "@/domain/gameTime"

/** In the order the to-do card lists them. */
export const STANDING_TASKS = ["battlePass", "reputation", "shop", "arRewards"] as const
export type StandingTask = (typeof STANDING_TASKS)[number]

/** When a task starts over: at a reset, or never by itself. */
export type Period = "weekly" | "monthly" | "none"

/**
 * What the snapshot says of a task: done or not, not read (the row is ticked
 * by hand instead), or that exports never tell (by hand only).
 */
export type Auto = "done" | "notDone" | "notRead" | "manual"

/** What a row shows besides done or not; stale counts already start over. */
export type StandingDetail =
  /** The Fates with a monthly limit. */
  | { task: "shop"; fates: { item: string; bought: number; limit: number }[] }
  | { task: "arRewards"; claimable: number }

export type Standing = {
  period: Period
  /** When this period began; a tick by hand counts until the next. */
  start: number
  /** When it ends; none for tasks that never start over by themselves. */
  endsAt?: number
  /** What a tick by hand counts for in place of `start`, for a period that is not a span of time. */
  key?: string
  auto: Auto
  /** Missing when the snapshot did not have it. */
  detail?: StandingDetail
}

const PERIODS: Record<StandingTask, Period> = {
  battlePass: "weekly",
  reputation: "weekly",
  shop: "monthly",
  arRewards: "none",
}
const MAX_AR = 60

type Span = { start: number; endsAt?: number }
type Judged = { auto: Auto; detail?: StandingDetail }

const NOT_READ: Judged = { auto: "notRead" }
const judged = (done: boolean, detail: StandingDetail): Judged => ({
  auto: done ? "done" : "notDone",
  detail,
})

export function standing(task: StandingTask, account: Account, now: number): Standing {
  const period = PERIODS[task]
  const span = spanOf(period, now)
  const ar = account.player?.ar
  // A new rank brings a new reward, so a tick lasts till the rank goes up.
  const key = task === "arRewards" && ar !== undefined ? `ar${ar}` : undefined
  return { period, ...span, key, ...judge(task, account, span.start) }
}

function spanOf(period: Period, now: number): Span {
  switch (period) {
    case "weekly":
      return { start: lastWeeklyReset(now), endsAt: nextWeeklyReset(now) }
    case "monthly":
      return { start: lastMonthlyReset(now), endsAt: nextMonthlyReset(now) }
    // A tick by hand on these lasts the game day.
    case "none":
      return { start: lastDailyReset(now) }
  }
}

function judge(task: StandingTask, account: Account, start: number): Judged {
  const tasks = account.tasks
  switch (task) {
    case "battlePass":
    case "reputation":
      return { auto: "manual" }
    case "shop": {
      const shop = tasks?.bargains
      const fates = shop?.fates.flatMap(({ item, bought, limit }) =>
        limit ? [{ item, bought: shop.at >= start ? bought : 0, limit }] : [],
      )
      if (!fates?.length) return NOT_READ
      return judged(
        fates.every(fate => fate.bought >= fate.limit),
        { task, fates },
      )
    }
    case "arRewards": {
      const claimed = tasks?.arRewards
      const ar = account.player?.ar
      if (!claimed || ar === undefined) return NOT_READ
      const taken = new Set(claimed)
      let claimable = 0
      // Every rank from 2 has a reward.
      for (let rank = 2; rank <= Math.min(ar, MAX_AR); rank++) if (!taken.has(rank)) claimable++
      return judged(claimable === 0, { task, claimable })
    }
  }
}
