// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The China server's resets: daily at 04:00 UTC+8, which is 20:00 UTC the
 * day before, weekly on Monday at that time and monthly on the 1st, and the
 * dates the game writes. The app reads China server accounts only. None of
 * this depends on the PC's time zone: the server's clock is kept here alone,
 * and lib/format writes times on the PC's.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY
/** 20:00 UTC on Sunday 4 January 1970: the first weekly reset after the epoch. */
const WEEKLY_ANCHOR = 3 * DAY + 20 * HOUR
const DAILY_ANCHOR = 20 * HOUR
/** UTC+8, less the 4 hours a game day lags the calendar day. */
const DAY_SHIFT = 4 * HOUR
const UTC8 = 8 * HOUR

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

export function nextDailyReset(now: number) {
  return lastDailyReset(now) + DAY
}

export function nextWeeklyReset(now: number) {
  return lastWeeklyReset(now) + WEEK
}

/** 04:00 UTC+8 on day `on` of the month `months` after the one `now` falls in (in UTC+8). */
function monthDay(now: number, months: number, on: number) {
  const local = new Date(now + UTC8)
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + months, on, 4) - UTC8
}

/** The latest monthly reset at or before `now`: day `on` (the 1st unless given) at 04:00. */
export function lastMonthlyReset(now: number, on = 1) {
  const reset = monthDay(now, 0, on)
  return reset <= now ? reset : monthDay(now, -1, on)
}

/** The first monthly reset after `now`. */
export function nextMonthlyReset(now: number, on = 1) {
  const reset = monthDay(now, 0, on)
  return reset > now ? reset : monthDay(now, 1, on)
}

/**
 * The game day `now` falls in, as days since 1 January 1970: day n is the
 * date n days after it, from 04:00 that day to 04:00 the next.
 */
export function gameDay(now: number) {
  return Math.floor((now + DAY_SHIFT) / DAY)
}

/** When game day `day` begins. */
export function gameDayStart(day: number) {
  return day * DAY - DAY_SHIFT
}

/** The game day of a date. */
export function gameDayOf(year: number, month: number, day: number) {
  return Date.UTC(year, month - 1, day) / DAY
}

/** The game's date at `now`: before 04:00 it is still the day before. Weekday 0 is Monday. */
export function gameDate(now: number) {
  const date = new Date(gameDay(now) * DAY)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: gameWeekday(now),
  }
}

/**
 * The date on the server's clock at `ms`, turning at midnight there: the date
 * the game writes for an event, a period or a version.
 */
export function serverDate(ms: number) {
  const date = new Date(ms + UTC8)
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

const pad = (n: number) => String(n).padStart(2, "0")

/** "11-04", on the server's clock. */
export function serverMonthDay(ms: number) {
  const { month, day } = serverDate(ms)
  return `${pad(month)}-${pad(day)}`
}

/** "2026-11-04", on the server's clock. */
export function serverDay(ms: number) {
  return `${serverDate(ms).year}-${serverMonthDay(ms)}`
}

/** The game's day of the week at `now`: 0 is Monday, 6 Sunday; days turn at the daily reset. */
export function gameWeekday(now: number) {
  return Math.round((lastDailyReset(now) - WEEKLY_ANCHOR) / DAY) % 7
}

/** Daily resets after `from` up to and including `to`. */
export function dailyResetsBetween(from: number, to: number) {
  return Math.max(0, Math.round((lastDailyReset(to) - lastDailyReset(from)) / DAY))
}
