// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Today's tasks carried from the snapshot to now: what the export gives as
 * times moves on by itself, counts start over at the server's resets, and
 * Realm Currency is counted on at the rate its Adeptal Energy gives.
 */

import type { Tasks } from "@/domain/account"
import { dailyResetsBetween, lastDailyReset, lastWeeklyReset } from "@/domain/gameTime"
import { realmRate } from "@/domain/overviewData"
import { text } from "@/text"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const RESIN_EVERY = 8 * MINUTE
export const RESIN_CAP = 200

type Resin = NonNullable<Tasks["resin"]>
type Realm = NonNullable<Tasks["realm"]>
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

/**
 * Realm Currency now, when it is full and how much comes an hour. It comes an hour's worth at a
 * time, at a minute of the hour the export does not give, so the snapshot's value gains that much
 * each whole hour since and the full time is the latest it can be: it may be full up to an hour
 * sooner. Without Adeptal Energy there is no rate and nothing changes.
 */
export function projectRealm({ value, limit, comfort }: Realm, takenAt: number, now: number) {
  const perHour = comfort === undefined ? undefined : realmRate(comfort)
  if (perHour === undefined || value >= limit) return { value, fullAt: undefined, perHour }
  const hours = Math.max(0, Math.floor((now - takenAt) / HOUR))
  return {
    value: Math.min(limit, value + hours * perHour),
    fullAt: takenAt + Math.ceil((limit - value) / perHour) * HOUR,
    perHour,
  }
}

/**
 * How long until Realm Currency is full, which can take days: days and hours from a day on, else
 * whole hours. Under an hour it may come at the next hour's mark or be there already, so the
 * time is not given.
 */
export function realmFullNote(ms: number) {
  const t = text.daily
  if (ms < HOUR) return t.realmFullWithinHour
  const hours = Math.round(ms / HOUR)
  return t.realmFullIn(
    hours >= 24 ? t.duration.days(Math.floor(hours / 24), hours % 24) : t.duration.hours(hours),
  )
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
