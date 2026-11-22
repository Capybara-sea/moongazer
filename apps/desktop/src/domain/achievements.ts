// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The achievements page's data: the game's achievements from the table `cargo
 * xtask gen-data` builds, and what an account has finished of them.
 */

import data from "@/generated/collection.json"
import type { Achievements } from "./account"

export type AchievementInfo = {
  id: number
  goal: number
  title: string
  desc: string
  target: number
  primogems: number
  hidden?: boolean
  previous?: number
  version?: string
  /** world, archon, hangout or commission. */
  quest?: string
  /** "none" when the game shows no count, "thousandths" for counts in thousandths. */
  count?: string
}

type Table = {
  achievementGoals: { id: number; name: string; icon: string }[]
  achievements: AchievementInfo[]
}

const table: Table = data

export const ACHIEVEMENT_GOALS = table.achievementGoals

/** One tier, with what the account has of it. */
export type AchievementRow = {
  info: AchievementInfo
  done: boolean
  /** When it was finished, where the game kept the time. */
  at?: number
  /** The series' count where it is known, as the game shows it. */
  current?: number
  /** The target as the game shows it; undefined where it shows no count. */
  shownTarget?: number
}

/** The tiers of one achievement, in order; most have one. */
export type AchievementSeries = { goal: number; rows: AchievementRow[] }

export type AchievementView = {
  series: AchievementSeries[]
  /** Finished and all, by goal id, of what this snapshot's game version has. */
  goals: Map<number, { done: number; total: number }>
  done: number
  total: number
  primogems: { earned: number; total: number }
  /** Ids in the snapshot that the bundled table lacks: a newer game version added them. */
  newer: number
}

/** The tiers by series, each series under its first tier, in the game's order. */
const SERIES: AchievementInfo[][] = (() => {
  const byId = new Map(table.achievements.map(a => [a.id, a]))
  const next = new Map<number, AchievementInfo>()
  for (const a of table.achievements) if (a.previous !== undefined) next.set(a.previous, a)
  const series: AchievementInfo[][] = []
  for (const a of table.achievements) {
    if (a.previous !== undefined && byId.has(a.previous)) continue
    const tiers = [a]
    for (let tier = next.get(a.id); tier; tier = next.get(tier.id)) tiers.push(tier)
    series.push(tiers)
  }
  return series
})()

/** Counts in thousandths show in whole units, rounded down. */
const scale = (info: AchievementInfo, n: number) =>
  info.count === "thousandths" ? Math.floor(n / 1000) : n

/**
 * The account's achievements in the game's order. What the snapshot's game
 * version has is what it lists as finished or unfinished; tiers it lists in
 * neither came later and are left out. Without that list every tier counts.
 */
export function achievementView(state: Achievements | undefined): AchievementView {
  const done = state?.done ?? new Map<number, number | undefined>()
  const progress = state?.progress ?? null
  const known = new Set(table.achievements.map(a => a.id))
  const inSnapshot = (id: number) => !progress || done.has(id) || progress.has(id)
  const series: AchievementSeries[] = []
  const goals = new Map<number, { done: number; total: number }>()
  let finished = 0
  let total = 0
  let earned = 0
  let primogems = 0
  for (const tiers of SERIES) {
    const listed = tiers.filter(t => inSnapshot(t.id))
    const [first] = listed
    if (!first) continue
    const rows = listed.map((info, i) => {
      const isDone = done.has(info.id)
      // Tiers of a series share one count. A finished tier has none of its own
      // in the export, but the next tier's, when that is not finished yet, is it.
      const next = listed[i + 1]
      const count = isDone
        ? next && !done.has(next.id)
          ? progress?.get(next.id)
          : undefined
        : progress?.get(info.id)
      const shows = info.count !== "none" && info.target > 1
      return {
        info,
        done: isDone,
        at: done.get(info.id),
        current: shows && count ? scale(info, count.current) : undefined,
        shownTarget: shows ? scale(info, info.target) : undefined,
      }
    })
    series.push({ goal: first.goal, rows })
    const goal = goals.get(first.goal) ?? { done: 0, total: 0 }
    for (const row of rows) {
      goal.total++
      total++
      primogems += row.info.primogems
      if (row.done) {
        goal.done++
        finished++
        earned += row.info.primogems
      }
    }
    goals.set(first.goal, goal)
  }
  let newer = 0
  for (const id of [...done.keys(), ...(progress?.keys() ?? [])]) if (!known.has(id)) newer++
  return {
    series,
    goals,
    done: finished,
    total,
    primogems: { earned, total: primogems },
    newer,
  }
}

export type AchievementFilter = "all" | "done" | "todo"
/** The game's order, or the latest finished first. */
export type AchievementSort = "game" | "recent"

/**
 * The series to show, each with only its tiers that pass; `hideHidden` leaves
 * out unfinished hidden tiers. Sorted by `recent`, a series goes by the latest
 * finish time among its tiers shown; those with none follow in the game's order.
 */
export function visibleSeries(
  view: AchievementView,
  {
    goal,
    filter,
    query,
    hideHidden,
    sort,
  }: {
    goal: number | null
    filter: AchievementFilter
    query: string
    hideHidden: boolean
    sort: AchievementSort
  },
): AchievementSeries[] {
  const q = query.trim().toLowerCase()
  const matches = (row: AchievementRow) =>
    row.info.title.toLowerCase().includes(q) || row.info.desc.toLowerCase().includes(q)
  const shown = view.series.flatMap(s => {
    if (goal !== null && s.goal !== goal) return []
    if (q && !s.rows.some(matches)) return []
    const rows = s.rows.filter(
      r =>
        (filter === "all" || r.done === (filter === "done")) &&
        !(hideHidden && r.info.hidden && !r.done),
    )
    return rows.length > 0 ? [{ goal: s.goal, rows }] : []
  })
  if (sort === "game") return shown
  const latest = new Map(shown.map(s => [s, Math.max(-1, ...s.rows.map(r => r.at ?? -1))]))
  return shown.sort((a, b) => (latest.get(b) ?? -1) - (latest.get(a) ?? -1))
}

/** Finished, unfinished and all tiers in a goal, or in every goal. */
export function filterCounts(view: AchievementView, goal: number | null) {
  const counts = goal === null ? { done: view.done, total: view.total } : view.goals.get(goal)
  const done = counts?.done ?? 0
  const all = counts?.total ?? 0
  return { all, done, todo: all - done }
}
