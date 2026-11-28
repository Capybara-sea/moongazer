// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { text } from "@/text"
import {
  formatAmount,
  formatAmounts,
  formatDate,
  formatDateTime,
  formatDelta,
  formatDuration,
  formatMonthDay,
  formatNumber,
  formatTime,
  formatTimeWithSeconds,
  formatWhen,
  maskUid,
  movedTo,
  setNumberStyle,
  signedDelta,
} from "./format"

// Most cases here are written in K, M and B; the default is the Chinese units.
beforeEach(() => setNumberStyle("kmb"))
afterEach(() => setNumberStyle("wan"))

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

describe("formatDate", () => {
  it("writes the local date with year, month and day", () => {
    expect(formatDate(new Date(2001, 0, 2, 23, 59).getTime())).toBe("2001-01-02")
  })
})

describe("formatDateTime", () => {
  it("pads every field", () => {
    expect(formatDateTime(at(3, 5, 7, 9))).toBe("2026-03-05 07:09")
  })
})

describe("formatMonthDay and formatTime", () => {
  it("pad the month, day, hour and minute to two digits", () => {
    expect(formatMonthDay(at(3, 5, 7, 9))).toBe("03-05")
    expect(formatMonthDay(at(12, 31, 23, 59))).toBe("12-31")
    expect(formatTime(at(3, 5, 7, 9))).toBe("07:09")
    expect(formatTime(at(11, 17, 0, 0))).toBe("00:00")
    expect(formatTime(at(12, 31, 23, 59))).toBe("23:59")
  })

  it("adds padded seconds when asked", () => {
    expect(formatTimeWithSeconds(at(3, 5, 7, 9) + 4000)).toBe("07:09:04")
  })
})

describe("formatNumber", () => {
  it("groups thousands and rounds to a whole number", () => {
    expect(formatNumber(0)).toBe("0")
    expect(formatNumber(3_280)).toBe("3,280")
    expect(formatNumber(1_234_567)).toBe("1,234,567")
    expect(formatNumber(-3_280)).toBe("-3,280")
    expect(formatNumber(1_234.6)).toBe("1,235")
  })
})

describe("formatAmount", () => {
  const { units } = text.number

  it("writes K, M and B from 10,000 on, one decimal under 100 of a unit", () => {
    expect(formatAmount(9_999)).toBe("9,999")
    expect(formatAmount(10_000)).toBe("10K")
    expect(formatAmount(12_345)).toBe("12.3K")
    expect(formatAmount(644_800)).toBe("645K")
    expect(formatAmount(12_480_000)).toBe("12.5M")
    expect(formatAmount(3_200_000_000)).toBe("3.2B")
  })

  it("writes the Chinese units when set to", () => {
    setNumberStyle("wan")
    expect(formatAmount(9_999)).toBe("9,999")
    expect(formatAmount(12_345)).toBe(text.number.unit("1.2", units.tenThousand))
    expect(formatAmount(6_448_000)).toBe(text.number.unit("645", units.tenThousand))
    expect(formatAmount(12_480_000)).toBe(text.number.unit("1,248", units.tenThousand))
    expect(formatAmount(250_000_000)).toBe(text.number.unit("2.5", units.hundredMillion))
  })

  it("rounds up what is needed and down what there is", () => {
    expect(formatAmount(2_661_000, "up")).toBe("2.7M")
    expect(formatAmount(2_669_000, "down")).toBe("2.6M")
    expect(formatAmount(1_234.2, "up")).toBe("1,235")
    expect(formatAmount(1_100_000, "up")).toBe("1.1M")
  })

  it("moves to the next unit when rounding reaches it", () => {
    expect(formatAmount(999_000)).toBe("999K")
    expect(formatAmount(999_960)).toBe("1M")
    expect(formatAmount(999_001, "up")).toBe("1M")
    expect(formatAmount(999_950_000)).toBe("1B")
    setNumberStyle("wan")
    expect(formatAmount(9_999_500)).toBe(text.number.unit("1,000", units.tenThousand))
    expect(formatAmount(99_995_000)).toBe(text.number.unit("1", units.hundredMillion))
    expect(formatAmount(99_990_001, "up")).toBe(text.number.unit("1", units.hundredMillion))
  })

  it("keeps the minus sign of negative amounts", () => {
    expect(formatAmount(-9_999)).toBe("-9,999")
    expect(formatAmount(-12_480_000)).toBe("-12.5M")
  })
})

describe("formatAmounts", () => {
  const { units } = text.number

  it("writes as formatAmount when that tells the values apart", () => {
    expect(formatAmounts([13_100_000, 12_700_000, 12_300_000])).toEqual(["13.1M", "12.7M", "12.3M"])
  })

  it("adds decimals until no two values read the same", () => {
    expect(formatAmounts([3_210_000, 3_170_000, 3_130_000, 3_090_000])).toEqual([
      "3.21M",
      "3.17M",
      "3.13M",
      "3.09M",
    ])
    setNumberStyle("wan")
    expect(formatAmounts([131_240_000, 129_760_000])).toEqual([
      text.number.unit("1.31", units.hundredMillion),
      text.number.unit("1.3", units.hundredMillion),
    ])
  })
})

describe("formatDelta", () => {
  it("signs small numbers and shortens large ones", () => {
    expect(formatDelta(160)).toBe("+160")
    expect(formatDelta(-3)).toBe("-3")
    expect(formatDelta(0)).toBe("0")
    expect(formatDelta(126_000)).toBe("+126K")
    expect(formatDelta(-14_000)).toBe("-14K")
  })

  it("groups thousands below ten thousand", () => {
    expect(formatDelta(9_999)).toBe("+9,999")
    expect(formatDelta(-1_234)).toBe("-1,234")
    expect(formatDelta(-12_480_000)).toBe("-12.5M")
  })
})

describe("signedDelta and movedTo", () => {
  it("say a rise is a gain, a fall a loss and no change neither", () => {
    expect(signedDelta(160)).toEqual({ text: "+160", way: "gain" })
    expect(signedDelta(-3)).toEqual({ text: "-3", way: "loss" })
    expect(signedDelta(0)).toEqual({ text: "0", way: "same" })
    expect(movedTo(9, 10)).toEqual({ text: text.number.movedTo(10), way: "gain" })
    expect(movedTo(10, 9)).toEqual({ text: text.number.movedTo(9), way: "loss" })
  })
})

describe("formatDuration", () => {
  it("pads minutes after hours and drops hours under one", () => {
    expect(formatDuration((65 * 60 + 59) * 1000)).toBe(text.time.hoursMinutes(1, "05"))
    expect(formatDuration(72 * 60_000)).toBe(text.time.hoursMinutes(1, "12"))
    expect(formatDuration(12 * 60_000 + 30_000)).toBe(text.time.minutes(12))
    expect(formatDuration(-5_000)).toBe(text.time.minutes(0))
  })
})

describe("maskUid", () => {
  it("keeps the first digit and hides each other digit", () => {
    expect(maskUid(987654321)).toBe("9••••••••")
    expect(maskUid(5)).toBe("5")
  })
})
