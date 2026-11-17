// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { dailyResetsBetween, lastDailyReset, lastWeeklyReset } from "./gameTime"

/** A moment given in China time (UTC+8). */
const cst = (month: number, day: number, hour: number, minute = 0) =>
  Date.UTC(2026, month - 1, day, hour - 8, minute)

describe("server resets", () => {
  it("resets daily at 04:00 China time", () => {
    expect(lastDailyReset(cst(11, 17, 3, 59))).toBe(cst(11, 16, 4))
    expect(lastDailyReset(cst(11, 17, 4))).toBe(cst(11, 17, 4))
    expect(lastDailyReset(cst(11, 17, 23))).toBe(cst(11, 17, 4))
  })

  it("resets weekly on Monday at 04:00 China time", () => {
    // 2026-11-16 is a Monday.
    expect(lastWeeklyReset(cst(11, 16, 3))).toBe(cst(11, 9, 4))
    expect(lastWeeklyReset(cst(11, 16, 4))).toBe(cst(11, 16, 4))
    expect(lastWeeklyReset(cst(11, 22, 23))).toBe(cst(11, 16, 4))
  })

  it("counts the daily resets between two moments", () => {
    expect(dailyResetsBetween(cst(11, 17, 3), cst(11, 17, 5))).toBe(1)
    expect(dailyResetsBetween(cst(11, 17, 5), cst(11, 17, 23))).toBe(0)
    expect(dailyResetsBetween(cst(11, 15, 21), cst(11, 18, 9))).toBe(3)
    expect(dailyResetsBetween(cst(11, 18, 9), cst(11, 15, 21))).toBe(0)
  })
})
