// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Today's tasks carried from the snapshot to now: what the export gives as
 * times moves on by itself, and counts start over at the server's resets.
 */

import type { Tasks } from "@/domain/account"
import { dailyResetsBetween, lastDailyReset, lastWeeklyReset } from "@/domain/gameTime"
import { text } from "@/text/zh"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const RESIN_EVERY = 8 * MINUTE
export const RESIN_CAP = 200

type Resin = NonNullable<Tasks["resin"]>
type Commissions = NonNullable<Tasks["commissions"]>
type Bosses = NonNullable<Tasks["weeklyBosses"]>
type Transformer = NonNullable<Tasks["transformer"]>

/** `part / whole` for a bar; 0 when the whole is 0. */
export function ratio(part: number, whole: number) {
  return whole > 0 ? part / whole : 0
}

/** Whole hours from an hour on, else minutes; for "full in about ...". */
export function formatDuration(ms: number) {
  return ms >= HOUR
    ? text.daily.duration.hours(Math.round(ms / HOUR))
    : text.daily.duration.minutes(Math.max(1, Math.ceil(ms / MINUTE)))
}

/**
 * Resin now and when it is full. At or above the cap (Fragile Resin can take
 * it past) the export has no next point and nothing changes.
 */
export function projectResin({ value, nextAt }: Resin, now: number) {
  if (nextAt === undefined || value >= RESIN_CAP) return { value, fullAt: undefined }
  const gained = now >= nextAt ? 1 + Math.floor((now - nextAt) / RESIN_EVERY) : 0
  return {
    value: Math.min(RESIN_CAP, value + gained),
    fullAt: nextAt + (RESIN_CAP - value - 1) * RESIN_EVERY,
  }
}

/** Commissions now: a daily reset after the snapshot starts them over. */
export function currentCommissions(commissions: Commissions, takenAt: number, now: number) {
  const reset = lastDailyReset(now) > takenAt
  return reset ? { ...commissions, finished: 0, claimed: false, reset } : { ...commissions, reset }
}

/** Weekly boss discounts now: a weekly reset after the snapshot gives them all back. */
export function currentBosses({ left, limit }: Bosses, takenAt: number, now: number) {
  const reset = lastWeeklyReset(now) > takenAt
  const remaining = reset ? limit : left
  return { left: remaining, limit, used: Math.max(0, limit - remaining), reset }
}

/** Whether the transformer is ready, and how much of its cooldown has passed. */
export function transformerState({ usedAt, readyAt }: Transformer, now: number) {
  const ready = readyAt <= now
  return { ready, progress: ready ? 1 : Math.max(0, ratio(now - usedAt, readyAt - usedAt)) }
}

/**
 * Welkin days left now (each daily reset uses one), the reset it runs out at,
 * and whether today's Primogems came: the game hands them over at the first
 * login after a reset, so they did if the snapshot was taken since today's.
 */
export function currentWelkin(days: number, takenAt: number, now: number) {
  const left = Math.max(0, days - dailyResetsBetween(takenAt, now))
  return {
    days: left,
    endsAt: lastDailyReset(takenAt) + days * DAY,
    claimedToday: left > 0 && takenAt >= lastDailyReset(now),
  }
}
