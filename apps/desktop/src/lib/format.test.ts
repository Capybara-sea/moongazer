// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { text } from "@/text/zh"
import {
  formatAmount,
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
  signedDelta,
} from "./format"

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
  it("counts in units of ten thousand from 10,000 on", () => {
    expect(formatAmount(9_999)).toBe("9,999")
    expect(formatAmount(10_000)).toBe(text.number.tenThousand("1.0"))
    expect(formatAmount(12_345)).toBe(text.number.tenThousand("1.2"))
    expect(formatAmount(12_480_000)).toBe(text.number.tenThousand("1,248.0"))
  })

  it("keeps the minus sign of negative amounts", () => {
    expect(formatAmount(-9_999)).toBe("-9,999")
    expect(formatAmount(-12_480_000)).toBe(text.number.tenThousand("-1,248.0"))
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

  it("groups thousands on both sides of ten thousand", () => {
    expect(formatDelta(9_999)).toBe("+9,999")
    expect(formatDelta(-1_234)).toBe("-1,234")
    expect(formatDelta(12_480_000)).toBe(`+${text.number.tenThousand("1,248.0")}`)
    expect(formatDelta(-12_480_000)).toBe(`-${text.number.tenThousand("1,248.0")}`)
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
