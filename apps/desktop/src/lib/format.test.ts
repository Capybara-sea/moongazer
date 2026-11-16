// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { text } from "@/text/zh"
import { formatDateTime, formatDelta, formatWhen } from "./format"

const now = new Date(2026, 10, 17, 12, 0).getTime()
const at = (month: number, day: number, hour: number, minute = 0, year = 2026) =>
  new Date(year, month - 1, day, hour, minute).getTime()

describe("formatWhen", () => {
  it("counts minutes and hours within a day", () => {
    expect(formatWhen(now - 20_000, now)).toBe(text.time.justNow)
    expect(formatWhen(at(11, 17, 11, 55), now)).toBe(text.time.minutesAgo(5))
    expect(formatWhen(at(11, 16, 16), now)).toBe(text.time.hoursAgo(20))
  })

  it("names yesterday and the day before by the calendar", () => {
    expect(formatWhen(at(11, 16, 9), now)).toBe(text.time.yesterday)
    expect(formatWhen(at(11, 15, 23), now)).toBe(text.time.dayBefore)
  })

  it("falls back to the date, with the year when it differs", () => {
    expect(formatWhen(at(11, 13, 21), now)).toBe("11-13")
    expect(formatWhen(at(12, 30, 8, 0, 2025), now)).toBe("2025-12-30")
    expect(formatWhen(now + 3 * 60_000, now)).toBe("11-17")
  })
})

describe("formatDateTime", () => {
  it("pads every field", () => {
    expect(formatDateTime(at(3, 5, 7, 9))).toBe("2026-03-05 07:09")
  })
})

describe("formatDelta", () => {
  it("signs small numbers and shortens large ones", () => {
    expect(formatDelta(160)).toBe("+160")
    expect(formatDelta(-3)).toBe("-3")
    expect(formatDelta(0)).toBe("0")
    expect(formatDelta(126_000)).toBe(`+${text.number.tenThousand("12.6")}`)
    expect(formatDelta(-140_000)).toBe(`-${text.number.tenThousand("14.0")}`)
  })
})
