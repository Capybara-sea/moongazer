// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The home page's calendar: the version, the challenges' periods and the
 * events the newest snapshot has running. Versions are estimated: 7.2 came
 * out on 4 November 2026, and one has come every 42 days since 5.3, the
 * update's maintenance starting at 06:00 UTC+8.
 */

import type { Account } from "@/domain/account"
import { activity } from "@/domain/activities"
import { gameDayOf, gameDayStart, lastMonthlyReset, nextMonthlyReset } from "@/domain/gameTime"
import { STYGIAN_SEASONS } from "@/domain/overviewData"
import { burstOf } from "@/domain/resinPlan"

const HOUR = 3_600_000
const VERSION_DAYS = 42
const ANCHOR_DAY = gameDayOf(2026, 11, 4)
/** 06:00 is two hours into the game day. */
const MAINTENANCE = 2 * HOUR
/** The Spiral Abyss opens on the 16th of each month; the theater on the 1st. */
const ABYSS_DAY = 16
/** The Stygian Onslaught's event, which its own row stands for. */
const STYGIAN = "LEY_LINE_CHALLENGE"

export type Span = { start: number; end: number }

/** The version running at `now`, from its update to the next, as estimated. */
export function versionSpan(now: number): Span {
  const update = (n: number) => gameDayStart(ANCHOR_DAY + n * VERSION_DAYS) + MAINTENANCE
  let n = Math.floor((now - update(0)) / (VERSION_DAYS * 24 * HOUR))
  // The estimate's days are game days, so step past any rounding at the edges.
  while (update(n) > now) n--
  while (update(n + 1) <= now) n++
  return { start: update(n), end: update(n + 1) }
}

export type CalendarItem = Span & {
  key: string
  kind: "abyss" | "theater" | "stygian" | "event"
  /** An event's id; its name is the bundled data's. */
  activityId?: number
  /** The Stygian Onslaught's burst, within its season. */
  burst?: Span
}

/**
 * The calendar at `now`: the version, and its rows: the Spiral Abyss, the
 * theater and the Stygian Onslaught, then the events in the snapshot that have
 * not ended and start within the version, by start. The Stygian Onslaught's
 * season comes from the bundled table, with its burst; past the table's last
 * season, from the snapshot's event. Without an account, the first three rows
 * at most.
 */
export function calendar(account: Account | undefined, now: number) {
  const version = versionSpan(now)
  const items: CalendarItem[] = []
  // The export's own times win while they cover now.
  const abyss = account?.tasks?.abyss
  items.push({
    key: "abyss",
    kind: "abyss",
    ...(abyss && abyss.start <= now && now < abyss.end
      ? { start: abyss.start, end: abyss.end }
      : { start: lastMonthlyReset(now, ABYSS_DAY), end: nextMonthlyReset(now, ABYSS_DAY) }),
  })
  items.push({
    key: "theater",
    kind: "theater",
    start: lastMonthlyReset(now),
    end: nextMonthlyReset(now),
  })
  const events = (account?.events ?? []).filter(
    event => event.end > now && event.start < version.end,
  )
  const season = STYGIAN_SEASONS.find(s => s.begin !== undefined && s.begin <= now && now < s.end)
  const stygian = events.find(event => activity(event.id).type === STYGIAN)
  if (season?.begin !== undefined) {
    const burst = burstOf(season)
    items.push({ key: "stygian", kind: "stygian", start: season.begin, end: season.end, burst })
  } else if (stygian) {
    items.push({ key: "stygian", kind: "stygian", start: stygian.start, end: stygian.end })
  }
  const others = events
    .filter(event => event !== stygian)
    .toSorted((a, b) => a.start - b.start || a.end - b.end || a.id - b.id)
  for (const event of others) {
    items.push({
      key: `event:${event.id}`,
      kind: "event",
      activityId: event.id,
      start: event.start,
      end: event.end,
    })
  }
  return { version, items }
}
