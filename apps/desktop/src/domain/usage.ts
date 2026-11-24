// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Time played as auto sync saw it: each login from its first snapshot to its
 * last change, or to now while the game is read. Time with nothing changing
 * at the end of a login is not seen, nor are logins without auto sync, so
 * these are at least what was played.
 */

import { lastDailyReset, lastMonthlyReset, lastWeeklyReset } from "@/domain/gameTime"
import type { Snapshot } from "@/lib/backend"

export type Usage = {
  today: number
  week: number
  month: number
  total: number
  logins: number
  /** When the first login seen began; none without one. */
  since?: number
}

/** Each login's span, from its snapshots and head rows. */
function logins(snapshots: readonly Snapshot[], now: number) {
  const spans = new Map<number, { start: number; end: number }>()
  for (const { session, takenAt, live } of snapshots) {
    if (session === null) continue
    const end = live ? Math.max(now, takenAt) : takenAt
    const span = spans.get(session)
    if (!span) spans.set(session, { start: takenAt, end })
    else {
      span.start = Math.min(span.start, takenAt)
      span.end = Math.max(span.end, end)
    }
  }
  return [...spans.values()]
}

/** Time played since today's, this week's and this month's reset, and in all, of one account's snapshots. */
export function usage(snapshots: readonly Snapshot[], now: number): Usage {
  const spans = logins(snapshots, now)
  const after = (from: number) =>
    spans.reduce((sum, { start, end }) => sum + Math.max(0, end - Math.max(start, from)), 0)
  return {
    today: after(lastDailyReset(now)),
    week: after(lastWeeklyReset(now)),
    month: after(lastMonthlyReset(now)),
    total: after(Number.NEGATIVE_INFINITY),
    logins: spans.length,
    since: spans.length > 0 ? Math.min(...spans.map(span => span.start)) : undefined,
  }
}
