// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The China server's resets: daily at 04:00 UTC+8, which is 20:00 UTC the
 * day before, and weekly on Monday at that time. The app reads China server
 * accounts only.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY
/** 20:00 UTC on Sunday 4 January 1970: the first weekly reset after the epoch. */
const WEEKLY_ANCHOR = 3 * DAY + 20 * HOUR
const DAILY_ANCHOR = 20 * HOUR

function last(now: number, anchor: number, period: number) {
  return Math.floor((now - anchor) / period) * period + anchor
}

/** The latest daily reset at or before `now` (unix milliseconds). */
export function lastDailyReset(now: number) {
  return last(now, DAILY_ANCHOR, DAY)
}

/** The latest weekly reset at or before `now`. */
export function lastWeeklyReset(now: number) {
  return last(now, WEEKLY_ANCHOR, WEEK)
}

/** The game's day of the week at `now`: 0 is Monday, 6 Sunday; days turn at the daily reset. */
export function gameWeekday(now: number) {
  return Math.round((lastDailyReset(now) - WEEKLY_ANCHOR) / DAY) % 7
}

/** Daily resets after `from` up to and including `to`. */
export function dailyResetsBetween(from: number, to: number) {
  return Math.max(0, Math.round((lastDailyReset(to) - lastDailyReset(from)) / DAY))
}
