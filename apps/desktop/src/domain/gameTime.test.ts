// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import {
  dailyResetsBetween,
  gameDate,
  gameDay,
  gameDayOf,
  gameDayStart,
  lastDailyReset,
  lastMonthlyReset,
  lastWeeklyReset,
  nextDailyReset,
  nextMonthlyReset,
  nextWeeklyReset,
  serverDay,
  serverMonthDay,
} from "./gameTime"

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

describe("next resets", () => {
  it("gives the next daily and weekly reset", () => {
    expect(nextDailyReset(cst(11, 17, 3, 59))).toBe(cst(11, 17, 4))
    expect(nextDailyReset(cst(11, 17, 4))).toBe(cst(11, 18, 4))
    expect(nextWeeklyReset(cst(11, 16, 3))).toBe(cst(11, 16, 4))
    expect(nextWeeklyReset(cst(11, 16, 4))).toBe(cst(11, 23, 4))
  })

  it("resets monthly on the 1st at 04:00 China time", () => {
    expect(lastMonthlyReset(cst(11, 1, 3, 59))).toBe(cst(10, 1, 4))
    expect(lastMonthlyReset(cst(11, 1, 4))).toBe(cst(11, 1, 4))
    expect(lastMonthlyReset(cst(11, 30, 23))).toBe(cst(11, 1, 4))
    expect(nextMonthlyReset(cst(11, 1, 3, 59))).toBe(cst(11, 1, 4))
    expect(nextMonthlyReset(cst(11, 1, 4))).toBe(cst(12, 1, 4))
  })

  it("crosses the year and takes another day of the month", () => {
    expect(nextMonthlyReset(cst(12, 20, 12))).toBe(Date.UTC(2027, 0, 1, -4))
    expect(lastMonthlyReset(Date.UTC(2027, 0, 1, -5))).toBe(cst(12, 1, 4))
    expect(lastMonthlyReset(cst(11, 16, 3), 16)).toBe(cst(10, 16, 4))
    expect(nextMonthlyReset(cst(11, 16, 4), 16)).toBe(cst(12, 16, 4))
  })
})

describe("game days", () => {
  it("numbers game days by their date, turning at 04:00 China time", () => {
    const day = Date.UTC(2026, 10, 17) / 86_400_000
    expect(gameDay(cst(11, 17, 4))).toBe(day)
    expect(gameDay(cst(11, 18, 3, 59))).toBe(day)
    expect(gameDay(cst(11, 17, 3, 59))).toBe(day - 1)
    expect(gameDayStart(day)).toBe(cst(11, 17, 4))
    expect(gameDayOf(2026, 11, 17)).toBe(day)
  })

  it("gives the game's date, still the day before until 04:00", () => {
    // 2026-11-20 is a Friday.
    expect(gameDate(cst(11, 21, 1))).toEqual({ year: 2026, month: 11, day: 20, weekday: 4 })
    expect(gameDate(cst(11, 21, 4))).toEqual({ year: 2026, month: 11, day: 21, weekday: 5 })
    expect(gameDate(Date.UTC(2027, 0, 1, -5))).toEqual({
      year: 2026,
      month: 12,
      day: 31,
      weekday: 3,
    })
  })
})

describe("dates on the server's clock", () => {
  it("writes the date in China time whatever the PC's zone, turning at midnight", () => {
    expect(serverMonthDay(cst(11, 4, 6))).toBe("11-04")
    expect(serverMonthDay(cst(11, 4, 0))).toBe("11-04")
    expect(serverMonthDay(cst(11, 3, 23, 59))).toBe("11-03")
    expect(serverDay(Date.UTC(2026, 11, 31, 16))).toBe("2027-01-01")
  })
})
