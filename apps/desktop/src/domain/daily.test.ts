// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import data from "@/generated/overview.json"
import { text } from "@/i18n"
import {
  currentBosses,
  currentCommissions,
  currentWelkin,
  formatDuration,
  projectRealm,
  projectResin,
  ratio,
  realmFullNote,
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

describe("realm currency", () => {
  const takenAt = cst(11, 22, 19, 41)
  const HOUR = 60 * MINUTE
  // The rate table is regenerated with every game version, so the cases are picked from it.
  const [first, second] = data.realmRates
  const top = data.realmRates.at(-1)
  if (!first || !second || !top) throw new Error("the table lacks comfort levels")
  const perHour = top.perHour
  const realm = { value: 450, limit: 2400, comfort: top.comfort }

  it("gains an hour's worth each whole hour after the snapshot", () => {
    expect(projectRealm(realm, takenAt, takenAt + HOUR - 1).value).toBe(450)
    expect(projectRealm(realm, takenAt, takenAt + HOUR).value).toBe(450 + perHour)
    const later = projectRealm(realm, takenAt, takenAt + 3 * HOUR + 30 * MINUTE)
    expect(later.value).toBe(450 + 3 * perHour)
  })

  it("is full at the latest time it can be, and stops at the limit", () => {
    const hours = Math.ceil(1950 / perHour)
    expect(projectRealm(realm, takenAt, takenAt).fullAt).toBe(takenAt + hours * HOUR)
    expect(projectRealm(realm, takenAt, takenAt + (hours - 1) * HOUR).value).toBeLessThan(2400)
    expect(projectRealm(realm, takenAt, takenAt + hours * HOUR).value).toBe(2400)
    expect(projectRealm(realm, takenAt, takenAt + 1000 * HOUR).value).toBe(2400)
    // A part of an hour's worth still takes the whole hour.
    expect(projectRealm({ ...realm, value: 2399 }, takenAt, takenAt).fullAt).toBe(takenAt + HOUR)
  })

  it("goes by the level the Adeptal Energy reaches", () => {
    const rate = (comfort: number) => projectRealm({ ...realm, comfort }, takenAt, takenAt).perHour
    expect(rate(first.comfort)).toBe(first.perHour)
    expect(rate(second.comfort - 1)).toBe(first.perHour)
    expect(rate(second.comfort)).toBe(second.perHour)
    expect(rate(top.comfort * 2)).toBe(top.perHour)
  })

  it("leaves it as it is when full or without Adeptal Energy", () => {
    const full = { value: 2400, limit: 2400, comfort: top.comfort }
    expect(projectRealm(full, takenAt, takenAt + 5 * HOUR)).toEqual({
      value: 2400,
      fullAt: undefined,
      perHour,
    })
    const unknown = projectRealm({ value: 450, limit: 2400 }, takenAt, takenAt + 5 * HOUR)
    expect(unknown).toEqual({ value: 450, fullAt: undefined, perHour: undefined })
  })

  it("says how long in days and hours, and within the hour under one", () => {
    const d = text.daily.duration
    expect(realmFullNote(65 * HOUR)).toBe(text.daily.realmFullIn(d.days(2, 17)))
    expect(realmFullNote(48 * HOUR - 10 * MINUTE)).toBe(text.daily.realmFullIn(d.days(2, 0)))
    expect(realmFullNote(5 * HOUR + 10 * MINUTE)).toBe(text.daily.realmFullIn(d.hours(5)))
    expect(realmFullNote(HOUR)).toBe(text.daily.realmFullIn(d.hours(1)))
    expect(realmFullNote(HOUR - 1)).toBe(text.daily.realmFullWithinHour)
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
