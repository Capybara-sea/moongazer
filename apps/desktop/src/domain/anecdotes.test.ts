// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import data from "@/generated/collection.json"
import { parseAccount } from "./account"
import {
  ANECDOTE_RULES,
  ANECDOTE_TOTALS,
  type AnecdoteInfo,
  type AnecdoteView,
  anecdoteView,
  byCharacter,
  visibleRows,
} from "./anecdotes"

const all: AnecdoteInfo[] = data.anecdotes
const { daily, lauma, chains } = ANECDOTE_RULES
const [variant, main] = Object.entries(data.anecdoteVariants)[0] ?? []
const plain = all.filter(
  a => !a.hidden && ![daily.id, daily.last, lauma.choice, lauma.farewell].includes(a.id),
)
const [first, second] = plain
const hiddenOne = all.find(a => a.hidden)

type Entries = Record<number, { state?: number; finishCount?: number }>

/** An account with these anecdotes, with Lauma or not; every value is made up. */
function account(entries: Entries, withLauma: boolean, reward?: object) {
  return parseAccount({
    format: "GOOD",
    version: 3,
    leyline: 1,
    characters: withLauma ? [{ key: lauma.character, level: 1 }] : [],
    gi_anecdotes: { anecdotes: entries, unlockedAreas: [1], reward },
  })
}

function view(entries: Entries, withLauma = true, reward?: object): AnecdoteView {
  const result = anecdoteView(account(entries, withLauma, reward))
  if (!result) throw new Error("no anecdotes read")
  return result
}

const row = (v: AnecdoteView, id: number) => v.rows.find(r => r.info.id === id)

/** Every anecdote recorded, as the export of an account that did them all would have it. */
const everything = (withLauma: boolean): Entries =>
  Object.fromEntries(
    all
      .filter(a => withLauma || a.id !== lauma.farewell)
      .map(a => [a.id, { state: 3, finishCount: 1 }]),
  )

describe("anecdoteView", () => {
  it("tells recorded, waiting and unmet apart, as the game counts them", () => {
    if (!first || !second) throw new Error("too few anecdotes")
    const v = view({ [first.id]: { state: 0, finishCount: 2 }, [second.id]: { state: 2 } })
    expect(row(v, first.id)?.status).toBe("recorded")
    expect(row(v, second.id)?.status).toBe("waiting")
    expect(v.recorded).toBe(1)
    expect(v.waiting).toBe(1)
    expect(v.unmet).toBe(v.total - 2)
  })

  it("reads a variant's id as its main entry's", () => {
    const v = view({ [Number(variant)]: { state: 3 } })
    expect(row(v, Number(main))?.recorded).toBe(true)
    expect(v.newer).toBe(0)
    expect(view({ 999999: { state: 3 } }).newer).toBe(1)
  })

  it("leaves out the farewell without Lauma, which makes the choice take more days", () => {
    const withHer = view({})
    const without = view({ [lauma.choice]: { state: 3, finishCount: 2 } }, false)
    expect(withHer.total).toBe(all.length)
    expect(without.total).toBe(all.length - 1)
    expect(row(without, lauma.farewell)?.status).toBe("absent")
    expect(row(without, lauma.choice)).toMatchObject({ days: 2, left: lauma.days - 2 })
    // Lauma counts as had when the export met the farewell, whatever its characters.
    expect(view({ [lauma.farewell]: { state: 3 } }, false).hasLauma).toBe(true)
  })

  it("totals the seals with the two special pairs", () => {
    expect(view({}).seals.total).toBe(ANECDOTE_TOTALS.withLauma.seals)
    expect(view({}, false).seals.total).toBe(ANECDOTE_TOTALS.withoutLauma.seals)
    expect(ANECDOTE_TOTALS.withLauma.seals).toBe(all.length - 4 + daily.total + 1 + lauma.seals)
    expect(ANECDOTE_TOTALS.withoutLauma.seals).toBe(all.length - 4 + daily.total + lauma.days)
  })

  it("tops the second of Heizou's pair up to the pair's total", () => {
    const v = view({ [daily.id]: { state: 3, finishCount: 3 } })
    expect(row(v, daily.id)?.days).toBe(3)
    expect(row(v, daily.last)?.seals).toBe(daily.total - 3)
    expect(row(view({}), daily.last)?.seals).toBeUndefined()
  })

  it("takes the earned seals from the game's count and says when a reward waits", () => {
    const v = view({}, true, { index: 3, progress: 10, target: 10 })
    expect(v.seals.earned).toBe(40)
    expect(v.seals.reward).toEqual({ claimed: 3, progress: 10, target: 10, full: true })
    // Leyline leaves a zero target out; the game's 10 stands in.
    expect(view({}, true, { index: 1, progress: 2 }).seals.reward?.target).toBe(10)
    expect(view({}).seals.earned).toBeUndefined()
  })
})

describe("fastest", () => {
  it("takes the most days of hidden ones, others two a day and the chains", () => {
    const done = everything(true)
    const v = view(done)
    expect(v.fastest).toEqual({ days: 0, hidden: 0, normal: 0, chain: undefined })
    if (!hiddenOne || !first || !second) throw new Error("too few anecdotes")
    const left = { ...done }
    delete left[hiddenOne.id]
    delete left[first.id]
    delete left[second.id]
    expect(view(left).fastest).toMatchObject({ days: 1, hidden: 1, normal: 2 })
  })

  it("gives a chain two days at least, and the choice its days left without Lauma", () => {
    const done = everything(true)
    const [chain] = chains
    if (!chain) throw new Error("no chains")
    const left = { ...done }
    for (const id of chain) delete left[id]
    expect(view(left).fastest).toMatchObject({ days: 2, chain: { ids: chain, days: 2 } })
    const without = everything(false)
    without[lauma.choice] = { state: 3, finishCount: 1 }
    // One a day: the days left, not two a day.
    expect(view(without, false).fastest.days).toBe(lauma.days - 1)
  })
})

describe("byCharacter and visibleRows", () => {
  it("puts the characters with the newest anecdotes first", () => {
    const groups = byCharacter(view({}).rows)
    const newest = groups.map(g => Math.max(...g.rows.map(r => r.info.id)))
    expect(newest).toEqual(newest.toSorted((a, b) => b - a))
  })

  it("keeps what is left to do, and searches a summary only once recorded", () => {
    if (!first || !second) throw new Error("too few anecdotes")
    const v = view({ [first.id]: { state: 3 } })
    const filters = { onlyTodo: true, onlyHidden: false, area: null, character: null, query: "" }
    const todo = visibleRows(v.rows, filters)
    expect(todo.some(r => r.info.id === first.id)).toBe(false)
    expect(todo.some(r => r.info.id === second.id)).toBe(true)
    const bySummary = (summary: string) =>
      visibleRows(v.rows, { ...filters, onlyTodo: false, query: summary }).map(r => r.info.id)
    expect(bySummary(first.summary)).toContain(first.id)
    expect(bySummary(second.summary)).not.toContain(second.id)
  })
})
