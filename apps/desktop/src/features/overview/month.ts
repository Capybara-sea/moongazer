// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Snapshot } from "@/lib/backend"

type Column = "primogems" | "mora" | "artifacts4" | "artifacts3" | "essence"

/**
 * Whether a snapshot has a value for the column. One without any 4★ or 3★
 * artifact is taken as filtered by the export, as on the count tiles.
 */
function known(snapshot: Snapshot, column: Column) {
  const { summary } = snapshot
  const lowStars = column === "artifacts4" || column === "artifacts3"
  if (lowStars && summary.artifacts4 === 0 && summary.artifacts3 === 0) return false
  return summary[column] !== null
}

/** A day's value and its change since the last earlier day that had one (null: none had). */
export type Cell = { value: number; delta: number | null }
/** A local day (its midnight) and its value in each column, null when no snapshot had it. */
export type DayRow = { day: number } & Record<Column, Cell | null>

/** A month as one number, year × 12 + month (0-based), so neighbours are one apart. */
export function monthOf(ms: number) {
  const date = new Date(ms)
  return date.getFullYear() * 12 + date.getMonth()
}

/** The first and last month that have snapshots, or null without any. */
export function monthBounds(snapshots: Snapshot[]) {
  if (snapshots.length === 0) return null
  const times = snapshots.map(s => s.takenAt)
  return { first: monthOf(Math.min(...times)), last: monthOf(Math.max(...times)) }
}

function startOfDay(ms: number) {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * The days of `month` that have snapshots, newest first. Each column shows
 * the day's last snapshot that has it, so a GOOD file without materials does
 * not hide the currencies read earlier that day; the change is against the
 * last earlier day with a value, which may be in an earlier month.
 */
export function monthRows(snapshots: Snapshot[], month: number): DayRow[] {
  const days = new Map<number, Snapshot[]>()
  // Among snapshots of the same time the later import is the last, as in storage's order.
  for (const snapshot of [...snapshots].sort((a, b) => a.takenAt - b.takenAt || a.id - b.id)) {
    const day = startOfDay(snapshot.takenAt)
    const group = days.get(day)
    if (group) group.push(snapshot)
    else days.set(day, [snapshot])
  }
  const last: Partial<Record<Column, number>> = {}
  const cell = (group: Snapshot[], column: Column): Cell | null => {
    const value = group.findLast(s => known(s, column))?.summary[column] ?? null
    if (value === null) return null
    const before = last[column]
    last[column] = value
    return { value, delta: before === undefined ? null : value - before }
  }
  const rows: DayRow[] = []
  for (const [day, group] of days) {
    if (monthOf(day) > month) break
    const row = {
      day,
      primogems: cell(group, "primogems"),
      mora: cell(group, "mora"),
      artifacts4: cell(group, "artifacts4"),
      artifacts3: cell(group, "artifacts3"),
      essence: cell(group, "essence"),
    }
    if (monthOf(day) === month) rows.push(row)
  }
  return rows.reverse()
}
