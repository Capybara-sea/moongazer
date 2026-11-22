// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { StygianRecord, Theater } from "@/domain/account"
import { text } from "@/text/zh"
import {
  allStars,
  currentAbyssPeriod,
  currentStygian,
  fightTime,
  stygianFullClear,
  stygianSummary,
  theaterActs,
  timeLeft,
} from "./challenges"

const HOUR = 3_600_000
const DAY = 24 * HOUR

describe("time left", () => {
  const now = 1_000 * DAY

  it("counts whole days, then hours under a day", () => {
    expect(timeLeft(now + 3 * DAY + 5 * HOUR, now)).toBe(text.challenges.daysLeft(3))
    expect(timeLeft(now + DAY, now)).toBe(text.challenges.daysLeft(1))
    expect(timeLeft(now + DAY - 1, now)).toBe(text.challenges.hoursLeft(23))
    expect(timeLeft(now + 10 * 60_000, now)).toBe(text.challenges.hoursLeft(1))
  })

  it("says when the period is over or its end is unknown", () => {
    expect(timeLeft(now, now)).toBe(text.challenges.ended)
    expect(timeLeft(undefined, now)).toBe(text.challenges.unknownEnd)
  })
})

describe("abyss record book", () => {
  const opened = (season: number) => season * DAY
  const periods = [
    { season: 7, floor: 12, chamber: 3, picked: ["A", "B"] },
    { season: 8, floor: 11, chamber: 2, picked: ["C"] },
  ]

  it("picks the period that opened when the running one did", () => {
    expect(currentAbyssPeriod(periods, 8 * DAY, opened)).toBe(periods[1])
  })

  it("has none when the book holds older periods only", () => {
    expect(currentAbyssPeriod(periods, 9 * DAY, opened)).toBeUndefined()
    expect(currentAbyssPeriod(undefined, 8 * DAY, opened)).toBeUndefined()
  })
})

describe("theater acts", () => {
  const record = (fields: Partial<Theater>): Theater => ({
    season: 1,
    acts: 6,
    stars: 5,
    maxStars: 8,
    starredActs: [1, 2, 3, 5, 6],
    ...fields,
  })

  it("marks each act starred, passed without a star, or not reached", () => {
    expect(theaterActs(record({}))).toEqual([
      "starred",
      "starred",
      "starred",
      "passed",
      "starred",
      "starred",
      "ahead",
      "ahead",
    ])
  })

  it("leaves out Lunar Mode's extra bouts", () => {
    const lunar = record({ acts: 10, stars: 12, maxStars: 12, starredActs: [1, 2, 3, 4, 5] })
    const acts = theaterActs(lunar)
    expect(acts).toHaveLength(10)
    expect(acts?.filter(act => act === "passed")).toHaveLength(5)
  })

  it("has none when the starred acts or the act count are unknown", () => {
    expect(theaterActs(record({ starredActs: undefined }))).toBeUndefined()
    expect(theaterActs(record({ maxStars: 0 }))).toBeUndefined()
  })
})

describe("all stars", () => {
  it("is done at the period's full stars, not before and not without a known total", () => {
    expect(allStars(36, 36)).toBe(true)
    expect(allStars(12, 12)).toBe(true)
    expect(allStars(35, 36)).toBe(false)
    expect(allStars(0, 0)).toBe(false)
  })
})

describe("stygian onslaught", () => {
  const seasons = [
    { season: 1, end: 10 * DAY },
    { season: 2, end: 20 * DAY },
    { season: 3, end: 30 * DAY },
  ]
  const record = (season: number, at: number, difficulty = 4): StygianRecord => ({
    season,
    difficulty,
    at,
    fights: [],
  })

  it("runs the season that ends first after now", () => {
    expect(currentStygian([], seasons, 12 * DAY)).toEqual({ end: 20 * DAY, record: undefined })
    expect(currentStygian([], seasons, 10 * DAY).end).toBe(20 * DAY)
  })

  it("uses the latest record of the running season only", () => {
    const records = [record(2, 13 * DAY, 4), record(2, 15 * DAY, 5), record(1, 16 * DAY, 6)]
    expect(currentStygian(records, seasons, 17 * DAY).record).toBe(records[1])
    expect(currentStygian(records, seasons, 25 * DAY).record).toBeUndefined()
  })

  it("past the table, uses the latest record of a season the table lacks", () => {
    const records = [record(3, 25 * DAY), record(4, 31 * DAY), record(4, 32 * DAY)]
    expect(currentStygian(records, seasons, 33 * DAY)).toEqual({
      end: undefined,
      record: records[2],
    })
  })

  it("sums up the fights", () => {
    const summary = stygianSummary({
      season: 1,
      difficulty: 5,
      at: 0,
      fights: [
        { time: 74, done: true, team: ["A", "B", "Traveler"] },
        { time: 58, done: true, team: ["B", "C"] },
        { time: 12, done: false, team: ["D"] },
      ],
    })
    expect(summary).toEqual({
      done: 2,
      total: 3,
      fastest: 58,
      totalTime: 132,
      team: ["A", "B", "Traveler", "C", "D"],
    })
  })

  it("counts a full clear only with every fight won at the hardest difficulty", () => {
    const fights = (...done: boolean[]) => done.map(won => ({ time: 60, done: won, team: [] }))
    const run = (difficulty: number, won: boolean[]): StygianRecord => ({
      season: 1,
      difficulty,
      at: 0,
      fights: fights(...won),
    })
    expect(stygianFullClear(run(6, [true, true, true]))).toBe(true)
    expect(stygianFullClear(run(6, [true, false, true]))).toBe(false)
    expect(stygianFullClear(run(5, [true, true, true]))).toBe(false)
    expect(stygianFullClear(run(6, []))).toBe(false)
  })

  it("has no fastest or total time when no fight was won", () => {
    const summary = stygianSummary({
      season: 1,
      difficulty: 1,
      at: 0,
      fights: [{ time: 30, done: false, team: [] }],
    })
    expect(summary.fastest).toBeUndefined()
    expect(summary.totalTime).toBeUndefined()
  })

  it("writes a time under a minute in seconds, else in minutes and seconds", () => {
    expect(fightTime(52)).toBe(text.challenges.seconds(52))
    expect(fightTime(412)).toBe(text.challenges.minutesSeconds(6, 52))
    expect(fightTime(59.6)).toBe(text.challenges.minutesSeconds(1, 0))
  })
})
