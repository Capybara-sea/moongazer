// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { gameDayOf, gameDayStart } from "@/domain/gameTime"
import { lookup } from "@/domain/names"
import type { Auto, StandingDetail, StandingTask } from "@/domain/standingTasks"
import type { CustomRow, CustomTask, EventRow, StandingRow } from "@/domain/tasks"
import { text } from "@/text/zh"
import {
  dayInput,
  formatCountdown,
  parseDayInput,
  repeatText,
  rowCountdown,
  rowDetail,
  rowName,
} from "./taskText"

const t = text.tasks
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const NOW = Date.UTC(2026, 10, 20, 4)

function standing(task: StandingTask, detail?: StandingDetail, auto: Auto = "notDone") {
  const row: StandingRow = {
    kind: "standing",
    id: task,
    periodKey: "1",
    auto,
    judged: false,
    done: false,
    task,
    period: "weekly",
    endsAt: NOW + HOUR,
    detail,
  }
  return row
}

const fakeTask = (fields: Partial<CustomTask> = {}): CustomTask => ({
  id: "fake",
  name: "Fake task",
  repeat: "daily",
  days: 1,
  startDay: gameDayOf(2026, 11, 20),
  anchor: "start",
  note: "",
  ...fields,
})

describe("countdowns", () => {
  it("counts minutes under an hour, rounded up", () => {
    expect(formatCountdown(30_000)).toBe(t.countdown.minutes(1))
    expect(formatCountdown(59 * MINUTE)).toBe(t.countdown.minutes(59))
  })

  it("counts hours and minutes from an hour on", () => {
    expect(formatCountdown(HOUR)).toBe(t.countdown.hours(1, 0))
    expect(formatCountdown(3 * HOUR + 20 * MINUTE)).toBe(t.countdown.hours(3, 20))
    expect(formatCountdown(3 * HOUR + 20 * MINUTE + 1)).toBe(t.countdown.hours(3, 21))
  })

  it("counts days and hours from a day on", () => {
    expect(formatCountdown(24 * HOUR)).toBe(t.countdown.days(1, 0))
    expect(formatCountdown(2 * 24 * HOUR + 5 * HOUR + 30 * MINUTE)).toBe(t.countdown.days(2, 5))
  })

  it("never reads zero", () => {
    expect(formatCountdown(0)).toBe(t.countdown.minutes(1))
    expect(formatCountdown(-5 * MINUTE)).toBe(t.countdown.minutes(1))
  })
})

describe("standing rows", () => {
  it("names a standing task by the task list's name", () => {
    expect(rowName(standing("shop"))).toBe(t.standing.shop)
  })

  it("says a task the snapshot did not have was not read", () => {
    expect(rowDetail(standing("shop", undefined, "notRead"))).toBe(text.snapshot.notRead)
  })

  it("names each Fate in the shop", () => {
    const row = standing("shop", {
      task: "shop",
      fates: [{ item: "IntertwinedFate", bought: 2, limit: 5 }],
    })
    expect(rowDetail(row)).toBe(t.detail.fate(lookup("materials", "IntertwinedFate").name, 2, 5))
  })

  it("counts the Adventure Rank rewards left to claim", () => {
    expect(rowDetail(standing("arRewards", { task: "arRewards", claimable: 2 }))).toBe(
      t.detail.arRewards(2),
    )
  })

  it("has nothing to say of a task exports never have", () => {
    expect(rowDetail(standing("battlePass"))).toBeUndefined()
  })
})

describe("what a row counts down to", () => {
  it("is the end of the period for a standing task", () => {
    expect(rowCountdown(standing("battlePass"))).toBe(NOW + HOUR)
  })

  it("is nothing for a custom task not started", () => {
    const row: CustomRow = {
      kind: "custom",
      id: "custom:fake",
      periodKey: "1",
      auto: "manual",
      judged: false,
      done: false,
      custom: fakeTask(),
      startsAt: NOW + 24 * HOUR,
    }
    expect(rowCountdown(row)).toBeUndefined()
  })
})

describe("events and custom tasks", () => {
  const event = (fields: Partial<EventRow>): EventRow => ({
    kind: "event",
    id: "event:1",
    periodKey: "1",
    auto: "manual",
    judged: false,
    done: false,
    activityId: 1,
    name: null,
    group: "limited",
    endsAt: NOW + HOUR,
    ...fields,
  })

  it("numbers an event without a name, and counts its claimed tiers", () => {
    const row = event({ progress: { claimed: 2, total: 5 } })
    expect(rowName(row)).toBe(t.eventUnnamed(1))
    expect(rowDetail(row)).toBe(t.detail.count(2, 5))
    expect(rowDetail(event({}))).toBeUndefined()
  })

  it("says how a custom task repeats, when it starts and its note", () => {
    const task = fakeTask({ repeat: "days", days: 3, anchor: "done", note: "Fake note" })
    const startsAt = gameDayStart(gameDayOf(2026, 11, 22))
    const row: CustomRow = {
      kind: "custom",
      id: "custom:fake",
      periodKey: "1",
      auto: "manual",
      judged: false,
      done: false,
      custom: task,
      startsAt,
    }
    expect(repeatText(task)).toBe(`${t.repeat.days(3)}${t.byDone}`)
    expect(rowDetail(row)).toBe(
      [repeatText(task), t.startsOn(11, 22), "Fake note"].join(t.detail.separator),
    )
  })
})

describe("the start day field", () => {
  it("writes and reads a game day as a date", () => {
    const day = gameDayOf(2026, 11, 20)
    expect(dayInput(day)).toBe("2026-11-20")
    expect(parseDayInput("2026-11-20")).toBe(day)
  })

  it("reads nothing from an empty field", () => {
    expect(parseDayInput("")).toBeUndefined()
  })
})
