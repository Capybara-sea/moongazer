// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Snapshot } from "@/lib/backend"
import { usage } from "./usage"

/** A moment given in China time (UTC+8). */
const cst = (month: number, day: number, hour: number, minute = 0) =>
  Date.UTC(2026, month - 1, day, hour - 8, minute)
const HOUR = 3_600_000

let id = 0
/** A snapshot of a login, or an import without one. Every value is made up. */
const row = (session: number | null, takenAt: number, live = false): Snapshot => ({
  id: ++id,
  takenAt,
  importedAt: takenAt,
  source: "test",
  uid: null,
  summary: {} as Snapshot["summary"],
  hasRaw: false,
  review: false,
  session,
  live,
})

describe("time played", () => {
  // Monday 23 November is the week's first game day.
  const now = cst(11, 24, 12)

  it("adds up each login from its first snapshot to its last, cut at each reset", () => {
    const played = usage(
      [
        row(3, cst(11, 24, 11)),
        row(3, cst(11, 24, 10)),
        row(2, cst(11, 24, 5)),
        row(2, cst(11, 24, 3)),
        row(1, cst(11, 20, 21)),
        row(1, cst(11, 20, 20)),
        row(null, cst(11, 22, 12)),
      ],
      now,
    )
    expect(played).toEqual({
      today: 2 * HOUR,
      week: 3 * HOUR,
      month: 4 * HOUR,
      total: 4 * HOUR,
      logins: 3,
      since: cst(11, 20, 20),
    })
  })

  it("counts a login being read on to now", () => {
    const played = usage([row(4, cst(11, 24, 11, 30), true), row(4, cst(11, 24, 11))], now)
    expect(played.today).toBe(HOUR)
  })

  it("has nothing without a login", () => {
    expect(usage([row(null, cst(11, 22, 12))], now)).toEqual({
      today: 0,
      week: 0,
      month: 0,
      total: 0,
      logins: 0,
      since: undefined,
    })
  })
})
