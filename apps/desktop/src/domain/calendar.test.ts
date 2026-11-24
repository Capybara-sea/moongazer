// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "./account"
import { calendar, versionSpan } from "./calendar"
import { STYGIAN_SEASONS } from "./overviewData"

/** A moment given in China time (UTC+8). */
const cst = (month: number, day: number, hour: number, minute = 0) =>
  Date.UTC(2026, month - 1, day, hour - 8, minute)

/** An account with only the given parts. Every value is made up. */
const account = (parts: Partial<Account> = {}): Account => ({
  characters: [],
  weapons: [],
  artifacts: [],
  materials: new Map(),
  characterInfo: new Map(),
  ...parts,
})

describe("the version", () => {
  it("runs 42 days from one update's 06:00 to the next", () => {
    expect(versionSpan(cst(11, 24, 12))).toEqual({ start: cst(11, 4, 6), end: cst(12, 16, 6) })
    expect(versionSpan(cst(11, 4, 6))).toEqual({ start: cst(11, 4, 6), end: cst(12, 16, 6) })
    expect(versionSpan(cst(11, 4, 5, 59)).end).toBe(cst(11, 4, 6))
    expect(versionSpan(cst(12, 16, 6)).start).toBe(cst(12, 16, 6))
  })
})

describe("the calendar's rows", () => {
  const now = cst(11, 24, 12)

  it("has the challenges by the calendar without an account", () => {
    const { items } = calendar(undefined, now)
    expect(items.map(item => item.kind)).toEqual(["abyss", "theater", "stygian"])
    expect(items[0]).toMatchObject({ start: cst(11, 16, 4), end: cst(12, 16, 4) })
    expect(items[1]).toMatchObject({ start: cst(11, 1, 4), end: cst(12, 1, 4) })
    const season = STYGIAN_SEASONS.find(s => s.season === 5269013)
    expect(items[2]).toMatchObject({
      start: cst(11, 11, 10),
      end: season?.end,
      burst: { start: cst(11, 11, 10), end: cst(11, 21, 4) },
    })
  })

  it("takes the export's abyss times while they cover now", () => {
    const abyss = { stars: 0, maxStars: 36, start: cst(11, 16, 5), end: cst(12, 16, 5) }
    const { items } = calendar(account({ tasks: { abyss } }), now)
    expect(items[0]).toMatchObject({ start: abyss.start, end: abyss.end })
  })

  it("lists the running events by start, leaving out those ended and the Stygian Onslaught's", () => {
    const events = [
      { id: 2052, start: cst(11, 20, 10), end: cst(12, 1, 4) },
      { id: 5294, start: cst(11, 2, 4), end: cst(12, 30, 4) },
      { id: 5269, start: cst(11, 11, 10), end: cst(12, 20, 4) },
      { id: 1, start: cst(11, 1, 4), end: cst(11, 20, 4) },
    ]
    const { items } = calendar(account({ events }), now)
    expect(items.filter(item => item.kind === "event").map(item => item.activityId)).toEqual([
      5294, 2052,
    ])
  })

  it("leaves out events that start after the version", () => {
    const events = [{ id: 2052, start: cst(12, 17, 10), end: cst(12, 30, 4) }]
    const { items } = calendar(account({ events }), now)
    expect(items.some(item => item.kind === "event")).toBe(false)
  })

  it("takes the Stygian Onslaught from the snapshot past the bundled seasons", () => {
    const later = Date.UTC(2030, 0, 10, 4)
    const event = { id: 5269, start: later - 86_400_000, end: later + 86_400_000 }
    const { items } = calendar(account({ events: [event] }), later)
    expect(items.filter(item => item.kind === "stygian")).toEqual([
      { key: "stygian", kind: "stygian", start: event.start, end: event.end },
    ])
    expect(items.some(item => item.kind === "event")).toBe(false)
  })
})
