// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** Which period of each challenge is running, and what the export says about it. */

import type { AbyssPeriod, StygianRecord, Theater } from "@/domain/account"
import type { StygianSeason } from "@/domain/overviewData"
import { text } from "@/text/zh"

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** No difficulty has more acts. Lunar Mode's two extra bouts add to maxStars but are not acts. */
const MAX_ACTS = 10
/** The hardest Stygian Onslaught difficulty: the game's table has six (7.1, per Capture). */
const STYGIAN_TOP = 6

export type ActState = "starred" | "passed" | "ahead"

/** Whole days left, hours under a day, or that the period is over or its end unknown. */
export function timeLeft(end: number | undefined, now: number) {
  if (end === undefined) return text.challenges.unknownEnd
  const left = end - now
  if (left <= 0) return text.challenges.ended
  if (left < DAY) return text.challenges.hoursLeft(Math.max(1, Math.floor(left / HOUR)))
  return text.challenges.daysLeft(Math.floor(left / DAY))
}

/**
 * The record book's entry for the running Abyss period, the one that opened
 * when the export says the period did. The book usually holds older periods
 * only, so this is often none.
 */
export function currentAbyssPeriod(
  periods: AbyssPeriod[] | undefined,
  start: number,
  opened: (season: number) => number | undefined,
) {
  return periods?.find(period => opened(period.season) === start)
}

/**
 * Each act of the chosen difficulty: won a star, passed without one, or not
 * reached. The export has no act count, so it is maxStars less Lunar Mode's
 * extra bouts. None when Capture could not tell the starred acts.
 */
export function theaterActs(record: Theater): ActState[] | undefined {
  const starred = record.starredActs
  if (!starred || record.maxStars === 0) return undefined
  return Array.from({ length: Math.min(record.maxStars, MAX_ACTS) }, (_, i) =>
    starred.includes(i + 1) ? "starred" : i < record.acts ? "passed" : "ahead",
  )
}

/**
 * The Stygian Onslaught season running at `at`, the first to end after it
 * (seasons do not overlap), with the latest record of it. Past the table's
 * last season the running one is not in the table: then its end is unknown
 * and its record is the latest of a season the table lacks.
 */
export function currentStygian(
  records: StygianRecord[] | undefined,
  seasons: readonly StygianSeason[],
  at: number,
) {
  let running: StygianSeason | undefined
  for (const season of seasons) {
    if (season.end > at && (!running || season.end < running.end)) running = season
  }
  const known = new Set(seasons.map(s => s.season))
  let record: StygianRecord | undefined
  for (const r of records ?? []) {
    const ofRunning = running ? r.season === running.season : !known.has(r.season)
    if (ofRunning && (!record || r.at > record.at)) record = r
  }
  return { end: running?.end, record }
}

/** Every star the period offers is won: the Abyss's 36, or the chosen theater difficulty's. */
export function allStars(stars: number, maxStars: number) {
  return maxStars > 0 && stars >= maxStars
}

/** Every fight won at the hardest difficulty, the most a Stygian season offers. */
export function stygianFullClear(record: StygianRecord) {
  return (
    record.difficulty >= STYGIAN_TOP &&
    record.fights.length > 0 &&
    record.fights.every(fight => fight.done)
  )
}

/** Fights won, the fastest won fight in seconds, and everyone who fought, in order. */
/** A fight time in seconds: seconds under a minute, else minutes and seconds. */
export function fightTime(seconds: number) {
  const s = Math.round(seconds)
  return s < 60
    ? text.challenges.seconds(s)
    : text.challenges.minutesSeconds(Math.floor(s / 60), s % 60)
}

export function stygianSummary(record: StygianRecord) {
  const won = record.fights.filter(fight => fight.done)
  return {
    done: won.length,
    total: record.fights.length,
    fastest: won.length > 0 ? Math.min(...won.map(fight => fight.time)) : undefined,
    /** The fights won, added up. */
    totalTime: won.length > 0 ? won.reduce((sum, fight) => sum + fight.time, 0) : undefined,
    team: [...new Set(record.fights.flatMap(fight => fight.team))],
  }
}
