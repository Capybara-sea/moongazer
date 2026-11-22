// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { text } from "@/text/zh"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function startOfDay(ms: number) {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Just now, minutes or hours ago within a day, yesterday, the day before,
 * then "11-13", or "2025-11-13" in another year.
 */
export function formatWhen(ms: number, now = Date.now()) {
  const ago = now - ms
  if (ago >= 0 && ago < MINUTE) return text.time.justNow
  if (ago >= 0 && ago < HOUR) return text.time.minutesAgo(Math.floor(ago / MINUTE))
  if (ago >= 0 && ago < DAY) return text.time.hoursAgo(Math.floor(ago / HOUR))
  // Rounded: a day with a daylight saving change is not 24 hours long.
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / DAY)
  if (days === 1) return text.time.yesterday
  if (days === 2) return text.time.dayBefore
  const date = new Date(ms)
  const monthDay = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return date.getFullYear() === new Date(now).getFullYear()
    ? monthDay
    : `${date.getFullYear()}-${monthDay}`
}

/** "2026-11-13 21:04" in local time. */
export function formatDateTime(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${formatMonthDay(ms)} ${formatTime(ms)}`
}

/** "11-13" in local time. */
export function formatMonthDay(ms: number) {
  const d = new Date(ms)
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "21:04" in local time. */
export function formatTime(ms: number) {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "21:04:05" in local time. */
export function formatTimeWithSeconds(ms: number) {
  return `${formatTime(ms)}:${pad(new Date(ms).getSeconds())}`
}

const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
/** For amounts rounded already: keeps the decimals they have, up to the most formatAmounts adds. */
const groupedDecimals = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 })

/** "3,280". */
export function formatNumber(n: number) {
  return grouped.format(n)
}

/**
 * How large numbers are written: in K, M and B, or in the Chinese units of
 * ten thousand and a hundred million.
 */
export type NumberStyle = "kmb" | "wan"

let numberStyle: NumberStyle = "wan"

/** Set by the appearance store, from the saved setting and when it changes. */
export function setNumberStyle(style: NumberStyle) {
  numberStyle = style
}

type Unit = readonly [size: number, name: string]

const UNITS: Record<NumberStyle, readonly Unit[]> = {
  kmb: [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ],
  wan: [
    [1e8, text.number.units.hundredMillion],
    [1e4, text.number.units.tenThousand],
  ],
}

/** Which way a number is rounded: up suits what is needed, down what there is. */
export type Rounding = "nearest" | "up" | "down"

const ROUND: Record<Rounding, (n: number) => number> = {
  nearest: Math.round,
  up: Math.ceil,
  down: Math.floor,
}

/**
 * As formatNumber, but from 10,000 on in the units the settings name: one
 * decimal under 100 of a unit, none from there, and none when it is .0, as in
 * "12.3K", "645K" or "2.7M".
 */
export function formatAmount(n: number, rounding: Rounding = "nearest") {
  return amount(n, ROUND[rounding], 0)
}

/**
 * As formatAmount for each of `values`, with up to three more decimals where
 * fewer would write two of them the same, as on a chart's axis.
 */
export function formatAmounts(values: readonly number[]) {
  let written = values.map(n => amount(n, Math.round, 0))
  for (let more = 1; more <= 3 && new Set(written).size < written.length; more++) {
    written = values.map(n => amount(n, Math.round, more))
  }
  return written
}

function amount(n: number, round: (n: number) => number, more: number) {
  if (Math.abs(n) < 10_000) return formatNumber(round(n))
  const units = UNITS[numberStyle]
  const at = units.findIndex(([size]) => Math.abs(n) >= size)
  const written = inUnit(n, units[at] ?? [1, ""], round, more)
  // Rounding can reach the next unit up: 999,960 is "1M", not "1,000K".
  const next = units[at - 1]
  return next && written.size >= next[0] ? inUnit(n, next, round, more).label : written.label
}

/** `n` in `unit`, one decimal under 100 of it and `more` past that; and the size it rounded to. */
function inUnit(n: number, [size, name]: Unit, round: (n: number) => number, more: number) {
  const digits = (Math.abs(n / size) < 100 ? 1 : 0) + more
  // Scaled before dividing: 1,100,000 / 1e6 * 10 is a hair over 11, which rounds up to 12.
  const value = round((n * 10 ** digits) / size) / 10 ** digits
  return {
    size: Math.abs(value) * size,
    label: text.number.unit(groupedDecimals.format(value), name),
  }
}

/** "+160" or "-3"; from 10,000 on, in the units the settings name. */
export function formatDelta(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "-" : ""
  return sign + formatAmount(Math.abs(n))
}

/** Which way a change went: gains show green, losses red. */
export type Way = "gain" | "loss" | "same"
/** A signed number ("+160") or a new value ("→ 10"), with the way it went. */
export type Signed = { text: string; way: Way }
/** A label and the change after it, if any: "Primogems" and "+60". */
export type Labeled = { label: string; change: Signed | null }

export const wayOf = (n: number): Way => (n > 0 ? "gain" : n < 0 ? "loss" : "same")

/** As formatDelta, with the way it went. */
export const signedDelta = (n: number): Signed => ({ text: formatDelta(n), way: wayOf(n) })

/** "→ 10", a gain when it went up. */
export const movedTo = (from: number, to: number): Signed => ({
  text: text.number.movedTo(to),
  way: wayOf(to - from),
})

/** Hours and zero-padded minutes, or minutes alone under an hour; never below zero. */
export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / MINUTE))
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? text.time.hoursMinutes(hours, pad(minutes % 60)) : text.time.minutes(minutes)
}

/** The first digit, then a bullet for each other digit. */
export function maskUid(uid: number) {
  const digits = String(uid)
  return digits.charAt(0) + "•".repeat(digits.length - 1)
}
