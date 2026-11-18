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
const groupedTenths = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** "3,280". */
export function formatNumber(n: number) {
  return grouped.format(n)
}

/** As formatNumber, but from 10,000 on in units of 10,000 with one decimal, e.g. 1,248.0 of them. */
export function formatAmount(n: number) {
  return Math.abs(n) >= 10_000
    ? text.number.tenThousand(groupedTenths.format(n / 10_000))
    : formatNumber(n)
}

/** "+160" or "-3"; from 10,000 on, in units of 10,000 with one decimal. */
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
