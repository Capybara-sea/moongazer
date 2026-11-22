// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import data from "@/generated/collection.json"
import type { Achievements } from "./account"
import {
  type AchievementFilter,
  type AchievementInfo,
  type AchievementSort,
  achievementView,
  filterCounts,
  visibleSeries,
} from "./achievements"

const all: AchievementInfo[] = data.achievements

/** A three-tier series with counts, from the bundled table: its tiers in order. */
const tiers = (() => {
  const next = new Map(all.flatMap(a => (a.previous ? [[a.previous, a]] : [])))
  for (const first of all) {
    if (first.previous || first.count || first.target <= 1) continue
    const second = next.get(first.id)
    const third = second && next.get(second.id)
    if (second && third) return [first, second, third] as const
  }
  throw new Error("no three-tier series in the table")
})()
const [one, two, three] = tiers
const hidden = all.find(a => a.hidden && !a.previous && !next(a.id))
function next(id: number) {
  return all.some(a => a.previous === id)
}

/** Every bundled achievement unfinished at count 0, then the given ones finished or counted. */
function state(done: number[], counts: Record<number, number> = {}): Achievements {
  const progress = new Map<number, { current: number; total: number }>()
  for (const a of all) {
    if (!done.includes(a.id)) progress.set(a.id, { current: counts[a.id] ?? 0, total: a.target })
  }
  return { done: new Map(done.map(id => [id, 1_000])), progress }
}

const seriesOf = (view: ReturnType<typeof achievementView>, id: number) =>
  view.series.find(s => s.rows.some(r => r.info.id === id))

describe("achievementView", () => {
  it("puts a series' tiers in one card, in order", () => {
    const view = achievementView(state([]))
    expect(seriesOf(view, two.id)?.rows.map(r => r.info.id)).toEqual([one.id, two.id, three.id])
    expect(view.total).toBe(all.length)
    expect(view.done).toBe(0)
  })

  it("shows a finished tier's count only from the next tier while that is unfinished", () => {
    const view = achievementView(state([one.id], { [two.id]: 7 }))
    const rows = seriesOf(view, one.id)?.rows ?? []
    expect(rows.map(r => [r.done, r.current, r.at])).toEqual([
      [true, 7, 1_000],
      [false, 7, undefined],
      [false, 0, undefined],
    ])
    const finished = achievementView(state([one.id, two.id, three.id]))
    expect(seriesOf(finished, one.id)?.rows.map(r => r.current)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
  })

  it("leaves out tiers the snapshot lists as neither finished nor unfinished", () => {
    const older = state([one.id])
    older.progress?.delete(three.id)
    const view = achievementView(older)
    expect(seriesOf(view, one.id)?.rows.map(r => r.info.id)).toEqual([one.id, two.id])
    expect(view.total).toBe(all.length - 1)
    // Without the list of unfinished ones every tier counts.
    expect(achievementView({ done: new Map(), progress: null }).total).toBe(all.length)
  })

  it("counts ids the bundled table lacks as newer, and the primogems earned", () => {
    const withNew = state([one.id, 9_999_999])
    withNew.progress?.set(9_999_998, { current: 0, total: 1 })
    const view = achievementView(withNew)
    expect(view.newer).toBe(2)
    expect(view.done).toBe(1)
    expect(view.primogems.earned).toBe(one.primogems)
    expect(view.primogems.total).toBe(all.reduce((sum, a) => sum + a.primogems, 0))
  })
})

describe("visibleSeries", () => {
  const view = achievementView(state([one.id], { [two.id]: 7 }))
  const base = {
    goal: null,
    filter: "all" as AchievementFilter,
    query: "",
    hideHidden: false,
    sort: "game" as AchievementSort,
  }

  it("keeps only the tiers that pass the filter", () => {
    const todo = visibleSeries(view, { ...base, filter: "todo" })
    expect(todo.find(s => s.rows.some(r => r.info.id === two.id))?.rows.length).toBe(2)
    const done = visibleSeries(view, { ...base, filter: "done" })
    expect(done.map(s => s.rows.map(r => r.info.id))).toEqual([[one.id]])
  })

  it("searches titles and descriptions, a hidden one's too", () => {
    expect(visibleSeries(view, { ...base, query: one.title }).length).toBeGreaterThan(0)
    if (!hidden) throw new Error("no hidden one-tier achievement")
    const found = (done: boolean) =>
      visibleSeries(achievementView(state(done ? [hidden.id] : [], {})), {
        ...base,
        query: hidden.desc,
      }).some(s => s.rows.some(r => r.info.id === hidden.id))
    expect(found(true)).toBe(true)
    expect(found(false)).toBe(true)
  })

  it("leaves out unfinished hidden tiers when asked, not finished ones", () => {
    if (!hidden) throw new Error("no hidden one-tier achievement")
    const has = (done: boolean, hideHidden: boolean) =>
      visibleSeries(achievementView(state(done ? [hidden.id] : [], {})), {
        ...base,
        hideHidden,
      }).some(s => s.rows.some(r => r.info.id === hidden.id))
    expect(has(false, false)).toBe(true)
    expect(has(false, true)).toBe(false)
    expect(has(true, true)).toBe(true)
  })

  it("puts the latest finished first by the newest tier shown, the rest in the game's order", () => {
    const [a, c, untimed] = all.filter(item => !item.previous && !next(item.id))
    if (!a || !c || !untimed) throw new Error("no one-tier achievements")
    // A finished one without a time, as upstream leaves those before 2020-09-15, stays behind.
    const times = new Map<number, number | undefined>([
      [a.id, 3_000],
      [c.id, 1_000],
      [one.id, 2_000],
      [two.id, 5_000],
      [untimed.id, undefined],
    ])
    const finished = achievementView({ ...state([...times.keys()]), done: times })
    const firsts = (sort: AchievementSort, filter: AchievementFilter = "all") =>
      visibleSeries(finished, { ...base, filter, sort }).map(s => s.rows[0]?.info.id)
    const latest: (number | undefined)[] = [one.id, a.id, c.id]
    expect(firsts("recent").slice(0, 3)).toEqual(latest)
    expect(firsts("recent").slice(3)).toEqual(firsts("game").filter(id => !latest.includes(id)))
    // Tiers filtered out do not count: unfinished ones only keep the game's order.
    expect(firsts("recent", "todo")).toEqual(firsts("game", "todo"))
  })

  it("lists only the goal picked, and counts by it", () => {
    const goal = one.goal
    const shown = visibleSeries(view, { ...base, goal })
    expect(shown.every(s => s.goal === goal)).toBe(true)
    expect(filterCounts(view, goal)).toEqual({
      all: view.goals.get(goal)?.total,
      done: 1,
      todo: (view.goals.get(goal)?.total ?? 0) - 1,
    })
  })
})
