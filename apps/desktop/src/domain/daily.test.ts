// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { text } from "@/text/zh"
import {
  currentBosses,
  currentCommissions,
  currentWelkin,
  formatDuration,
  projectResin,
  ratio,
  transformerState,
} from "./daily"

/** A moment given in China time (UTC+8). */
const cst = (month: number, day: number, hour: number, minute = 0) =>
  Date.UTC(2026, month - 1, day, hour - 8, minute)

const MINUTE = 60_000

describe("resin", () => {
  const nextAt = cst(11, 15, 21, 4)

  it("keeps the snapshot's value until the next point is due", () => {
    expect(projectResin({ value: 120, nextAt }, nextAt - 1)).toEqual({
      value: 120,
      fullAt: nextAt + 79 * 8 * MINUTE,
    })
  })

  it("gains a point when it is due and one every 8 minutes after", () => {
    expect(projectResin({ value: 120, nextAt }, nextAt).value).toBe(121)
    expect(projectResin({ value: 120, nextAt }, nextAt + 8 * MINUTE - 1).value).toBe(121)
    expect(projectResin({ value: 120, nextAt }, nextAt + 8 * MINUTE).value).toBe(122)
  })

  it("stops at the cap", () => {
    const resin = { value: 199, nextAt }
    expect(projectResin(resin, nextAt).value).toBe(200)
    expect(projectResin(resin, nextAt + 1000 * MINUTE).value).toBe(200)
    expect(projectResin(resin, nextAt).fullAt).toBe(nextAt)
  })

  it("leaves resin at or above the cap as it is", () => {
    expect(projectResin({ value: 230 }, nextAt)).toEqual({ value: 230, fullAt: undefined })
    expect(projectResin({ value: 200, nextAt }, nextAt + MINUTE).value).toBe(200)
  })

  it("says how long until full in hours or minutes", () => {
    expect(formatDuration(5 * 60 * MINUTE + 10 * MINUTE)).toBe(text.daily.duration.hours(5))
    expect(formatDuration(60 * MINUTE)).toBe(text.daily.duration.hours(1))
    expect(formatDuration(59 * MINUTE + 1)).toBe(text.daily.duration.minutes(60))
    expect(formatDuration(1)).toBe(text.daily.duration.minutes(1))
  })
})

describe("resets after the snapshot", () => {
  const commissions = { finished: 4, total: 4, claimed: true }

  it("keeps commissions until the next 04:00", () => {
    const takenAt = cst(11, 16, 21)
    expect(currentCommissions(commissions, takenAt, cst(11, 17, 3, 59))).toEqual({
      ...commissions,
      reset: false,
    })
  })

  it("starts commissions over after 04:00", () => {
    const takenAt = cst(11, 16, 21)
    expect(currentCommissions(commissions, takenAt, cst(11, 17, 4))).toEqual({
      finished: 0,
      total: 4,
      claimed: false,
      reset: true,
    })
  })

  it("gives the weekly boss discounts back on Monday at 04:00", () => {
    // 2026-11-16 is a Monday.
    const bosses = { left: 1, limit: 3 }
    const takenAt = cst(11, 15, 21)
    expect(currentBosses(bosses, takenAt, cst(11, 16, 3))).toEqual({
      left: 1,
      limit: 3,
      used: 2,
      reset: false,
    })
    expect(currentBosses(bosses, takenAt, cst(11, 16, 4))).toEqual({
      left: 3,
      limit: 3,
      used: 0,
      reset: true,
    })
  })
})

describe("welkin", () => {
  const takenAt = cst(11, 15, 21, 4)

  it("uses a day at each daily reset after the snapshot", () => {
    expect(currentWelkin(23, takenAt, cst(11, 16, 3)).days).toBe(23)
    expect(currentWelkin(23, takenAt, cst(11, 16, 4)).days).toBe(22)
    expect(currentWelkin(23, takenAt, cst(11, 18, 9)).days).toBe(20)
  })

  it("does not go below zero", () => {
    expect(currentWelkin(2, takenAt, cst(11, 25, 9)).days).toBe(0)
  })

  it("counts today's Primogems as received when the snapshot is from after today's reset", () => {
    expect(currentWelkin(23, takenAt, cst(11, 16, 3)).claimedToday).toBe(true)
    expect(currentWelkin(23, takenAt, cst(11, 16, 9)).claimedToday).toBe(false)
    expect(currentWelkin(0, takenAt, takenAt).claimedToday).toBe(false)
  })

  it("runs out at the reset that many days after the snapshot's day began", () => {
    expect(currentWelkin(23, takenAt, takenAt).endsAt).toBe(cst(12, 8, 4))
    expect(currentWelkin(23, takenAt, cst(11, 20, 9)).endsAt).toBe(cst(12, 8, 4))
  })
})

describe("transformer", () => {
  const usedAt = cst(11, 11, 9)
  const readyAt = cst(11, 18, 9)

  it("shows how much of the cooldown has passed", () => {
    expect(transformerState({ usedAt, readyAt }, usedAt)).toEqual({ ready: false, progress: 0 })
    const half = transformerState({ usedAt, readyAt }, (usedAt + readyAt) / 2)
    expect(half).toEqual({ ready: false, progress: 0.5 })
  })

  it("is ready once the cooldown is over", () => {
    expect(transformerState({ usedAt, readyAt }, readyAt)).toEqual({ ready: true, progress: 1 })
  })
})

describe("ratio", () => {
  it("is zero for an empty whole", () => {
    expect(ratio(3, 0)).toBe(0)
    expect(ratio(1, 4)).toBe(0.25)
  })
})
