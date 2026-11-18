// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Snapshot } from "@/lib/backend"
import { formatMonthDay, formatTime } from "@/lib/format"

export type Mode = "snapshot" | "hour" | "day" | "month" | "year"
export type Range = 7 | 30 | 90 | "all"
export type Currency = "mora" | "primogems"
/**
 * One point of a chart: when it starts (the snapshot's time in snapshot
 * mode), the value at its end and the change during it.
 */
export type Bucket = { at: number; value: number; delta: number }

type TimeMode = Exclude<Mode, "snapshot">

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** Hour mode covers one week at most, which keeps a chart at 168 points. */
const HOURS = 7 * 24

export const PLOT_WIDTH = 600
export const PLOT_HEIGHT = 150

/** The start of the local hour, day, month or year that holds `ms`. */
function floor(ms: number, mode: TimeMode) {
  const date = new Date(ms)
  if (mode === "hour") date.setMinutes(0, 0, 0)
  else date.setHours(0, 0, 0, 0)
  if (mode === "month" || mode === "year") date.setDate(1)
  if (mode === "year") date.setMonth(0)
  return date.getTime()
}

/** `start` moved by `n` buckets: days and months step by the calendar, as their lengths vary. */
function shift(start: number, mode: TimeMode, n: number) {
  if (mode === "hour") return start + n * HOUR
  const date = new Date(start)
  if (mode === "day") date.setDate(date.getDate() + n)
  else if (mode === "month") date.setMonth(date.getMonth() + n)
  else date.setFullYear(date.getFullYear() + n)
  return date.getTime()
}

/**
 * One currency over time, oldest first. Snapshot mode has a point per
 * snapshot time; the others one per local hour, day, month or year, from the first
 * one in the range that holds or follows data up to the current one. A
 * bucket's value is its last snapshot's, or the bucket before's when it has
 * none; its change is against the bucket before (the first one's against the
 * last value before the range, or none). Hour mode always covers the last
 * week, month and year modes the whole history. Snapshots without the
 * currency (those without materials) are left out.
 */
export function buildBuckets(
  snapshots: Snapshot[],
  currency: Currency,
  mode: Mode,
  range: Range,
  now: number,
): Bucket[] {
  const points = snapshots
    .flatMap(s => {
      const value = s.summary[currency]
      return value === null ? [] : [{ at: s.takenAt, id: s.id, value }]
    })
    // Snapshots can share a time. The later import counts, as in storage's
    // order, and one point per time keeps `at` unique for keys and the hover.
    .sort((a, b) => a.at - b.at || a.id - b.id)
    .filter((point, i, sorted) => sorted[i + 1]?.at !== point.at)
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last) return []

  if (mode === "snapshot") {
    const from = range === "all" ? -Infinity : now - range * DAY
    return points.flatMap((point, i) => {
      const before = points[i - 1]
      if (point.at < from) return []
      return [{ at: point.at, value: point.value, delta: before ? point.value - before.value : 0 }]
    })
  }

  const end = floor(Math.max(now, last.at), mode)
  let start = floor(first.at, mode)
  if (mode === "hour") start = Math.max(start, shift(end, mode, 1 - HOURS))
  if (mode === "day" && range !== "all") start = Math.max(start, shift(end, mode, 1 - range))

  let cursor = points.findIndex(p => p.at >= start)
  if (cursor === -1) cursor = points.length
  let value = points[cursor - 1]?.value
  const buckets: Bucket[] = []
  for (let at = start; at <= end; at = shift(at, mode, 1)) {
    const until = shift(at, mode, 1)
    const before = value
    for (let p = points[cursor]; p && p.at < until; p = points[cursor]) {
      value = p.value
      cursor += 1
    }
    if (value !== undefined) {
      buckets.push({ at, value, delta: before === undefined ? 0 : value - before })
    }
  }
  return buckets
}

const pad = (n: number) => String(n).padStart(2, "0")

/** "11-15 21:04" for snapshots, "11-15 21:00" for hours, "11-15" for days, "2026-11" and "2026". */
export function bucketLabel(at: number, mode: Mode) {
  const date = new Date(at)
  if (mode === "year") return String(date.getFullYear())
  if (mode === "month") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
  if (mode === "day") return formatMonthDay(at)
  if (mode === "hour") return `${formatMonthDay(at)} ${pad(date.getHours())}:00`
  return `${formatMonthDay(at)} ${formatTime(at)}`
}

/** The first, middle and last bucket, for the labels under a chart. */
export function labelBuckets(buckets: Bucket[]) {
  const last = buckets.length - 1
  return [...new Set([0, Math.round(last / 2), last])].flatMap(i => buckets[i] ?? [])
}

const round = (n: number) => Math.round(n * 10) / 10

/**
 * A stepped line through the buckets (at least one) in a PLOT_WIDTH by
 * PLOT_HEIGHT box, y down, with four axis values from the top. The scale runs
 * from the lowest to the highest value with a tenth of the span added at each
 * end, but not below zero, as amounts never are.
 */
export function plotSeries(buckets: Bucket[]) {
  const values = buckets.map(b => b.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat series still needs a span to draw against.
  const padding = (max - min) * 0.1 || Math.max(max * 0.05, 1)
  const low = Math.max(0, min - padding)
  const high = max + padding
  const n = buckets.length
  const x = (i: number) => (n === 1 ? PLOT_WIDTH / 2 : (i / (n - 1)) * PLOT_WIDTH)
  const y = (v: number) => PLOT_HEIGHT - ((v - low) / (high - low)) * PLOT_HEIGHT
  const steps = values.slice(1).map((v, i) => ` H${round(x(i + 1))} V${round(y(v))}`)
  const start = `M0 ${round(y(values[0] ?? low))}`
  const line = n === 1 ? `${start} H${PLOT_WIDTH}` : start + steps.join("")
  return {
    line,
    area: `${line} V${PLOT_HEIGHT} H0 Z`,
    ticks: [0, 1, 2, 3].map(k => high - ((high - low) * k) / 3),
    /** Bucket i's point as fractions of the box's width and height. */
    point: (i: number) => ({ x: x(i) / PLOT_WIDTH, y: y(values[i] ?? low) / PLOT_HEIGHT }),
  }
}

/** The least share of the change strip kept for gains, above the zero line. */
const GAIN_SHARE = 2 / 3

/**
 * The change bars, as fractions of the strip's height from its top: gains
 * rise from the zero line and losses hang below it, the line placed so the
 * largest gain and the largest loss both fit. Losses get a third of the strip
 * at most: one large spend (a ten-pull, levelling a character) would otherwise
 * squash the everyday gains to a few pixels.
 */
export function changeBars(buckets: Bucket[]) {
  const gain = Math.max(0, ...buckets.map(b => b.delta))
  const loss = Math.max(0, ...buckets.map(b => -b.delta))
  const zero = loss === 0 ? 1 : Math.max(gain / (gain + loss), GAIN_SHARE)
  const bars = buckets.map(({ at, delta }) => {
    if (delta < 0) return { at, top: zero, height: (-delta / loss) * (1 - zero), loss: true }
    const height = gain === 0 ? 0 : (delta / gain) * zero
    return { at, top: zero - height, height, loss: false }
  })
  return { zero, gain, bars }
}
