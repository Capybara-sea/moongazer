// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account, Tasks } from "@/domain/account"
import { text } from "@/i18n"
import { CATCH_UP, dueReminders, nextDue, reminders } from "./reminders"

/** A moment given in China time (UTC+8). */
const cst = (month: number, day: number, hour: number, minute = 0) =>
  Date.UTC(2026, month - 1, day, hour - 8, minute)

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const takenAt = cst(11, 15, 10)

function account(tasks: Tasks, endgame?: Account["endgame"]): Account {
  return {
    tasks,
    endgame,
    characters: [],
    weapons: [],
    artifacts: [],
    materials: new Map(),
    characterInfo: new Map(),
  }
}

/** A made-up account token. */
const TOKEN = 7
const ids = (tasks: Tasks) => reminders(account(tasks), takenAt, TOKEN).map(r => r.id.split(":")[1])
const one = (tasks: Tasks) => {
  const [first, ...rest] = reminders(account(tasks), takenAt, TOKEN)
  expect(rest).toEqual([])
  return first
}

describe("reminders", () => {
  it("has nothing without task data", () => {
    expect(reminders(account({}), takenAt, TOKEN)).toEqual([])
  })

  it("names the account by its token, so two accounts' same event are both recorded", () => {
    const tasks = { commissions: { finished: 4, total: 4, claimed: false } }
    const [first] = reminders(account(tasks), takenAt, TOKEN)
    const [other] = reminders(account(tasks), takenAt, TOKEN + 1)
    expect(first).toMatchObject({ account: TOKEN })
    expect(first?.id.startsWith(`${TOKEN}:commissions:`)).toBe(true)
    expect(other?.id).not.toBe(first?.id)
  })

  it("reminds when resin will be full, unless it already is", () => {
    const nextAt = takenAt + 3 * MINUTE
    expect(one({ resin: { value: 190, nextAt } })).toMatchObject({
      at: nextAt + 9 * 8 * MINUTE,
      kind: "remind",
      page: "overview",
    })
    expect(ids({ resin: { value: 200 } })).toEqual([])
  })

  it("reminds when the last expedition is done", () => {
    const expeditions = [{ doneAt: takenAt + HOUR }, { doneAt: takenAt + 3 * HOUR }]
    expect(one({ expeditions })?.at).toBe(takenAt + 3 * HOUR)
    expect(ids({ expeditions: [{ doneAt: takenAt - HOUR }] })).toEqual([])
  })

  it("reminds when the transformer is ready again", () => {
    expect(one({ transformer: { usedAt: takenAt - DAY, readyAt: takenAt + DAY } })?.at).toBe(
      takenAt + DAY,
    )
  })

  it("reminds at the reset that leaves three welkin days, or at once with fewer", () => {
    // 04:00 on the 15th started the snapshot's game day; ten days run out ten resets later.
    const at = one({ welkin: { days: 10 } })?.at
    expect(at).toBe(cst(11, 25, 4) - 3 * DAY)
    expect(one({ welkin: { days: 2 } })).toMatchObject({
      at: takenAt,
      title: text.messages.welkinEnding(2),
    })
    expect(ids({ welkin: { days: 0 } })).toEqual([])
  })

  it("reminds of unclaimed commission rewards at 20:00, before the reset", () => {
    expect(one({ commissions: { finished: 4, total: 4, claimed: false } })?.at).toBe(
      cst(11, 15, 20),
    )
    expect(ids({ commissions: { finished: 4, total: 4, claimed: true } })).toEqual([])
    expect(ids({ commissions: { finished: 3, total: 4, claimed: false } })).toEqual([])
  })

  it("reminds of commissions at once when the snapshot is later in the game day", () => {
    const late = cst(11, 15, 23)
    const [first] = reminders(
      account({ commissions: { finished: 4, total: 4, claimed: false } }),
      late,
      TOKEN,
    )
    expect(first?.at).toBe(late)
  })

  it("mentions realm currency at 90% or more, once a game day", () => {
    const first = one({ realm: { value: 2200, limit: 2400 } })
    expect(first).toMatchObject({
      at: takenAt,
      body: text.messages.realmNearlyFullBody("2,200", "2,400"),
    })
    expect(ids({ realm: { value: 2000, limit: 2400 } })).toEqual([])
  })

  it("reminds two days before the Abyss resets, unless every star is won", () => {
    const end = cst(12, 16, 4) - 1
    const abyss = { start: cst(11, 16, 4), end, stars: 30, maxStars: 36 }
    expect(one({ abyss })?.at).toBe(end - 2 * DAY)
    expect(ids({ abyss: { ...abyss, stars: 36 } })).toEqual([])
  })

  it("reminds about an Abyss that ends within two days at once", () => {
    const end = takenAt + DAY
    const abyss = { start: end - 30 * DAY, end, stars: 9, maxStars: 36 }
    expect(one({ abyss })?.at).toBe(takenAt)
  })
})

describe("dueReminders and nextDue", () => {
  const list = [
    { id: "a", kind: "remind", title: "", body: "", at: takenAt, page: "overview" },
    { id: "b", kind: "remind", title: "", body: "", at: takenAt + HOUR, page: "overview" },
  ] as const

  it("records what is due, unless it came due too long ago", () => {
    expect(dueReminders(list, takenAt).map(r => r.id)).toEqual(["a"])
    expect(dueReminders(list, takenAt + HOUR).map(r => r.id)).toEqual(["a", "b"])
    expect(dueReminders(list, takenAt + CATCH_UP).map(r => r.id)).toEqual(["b"])
  })

  it("knows when the next one comes due", () => {
    expect(nextDue(list, takenAt)).toBe(takenAt + HOUR)
    expect(nextDue(list, takenAt + HOUR)).toBeUndefined()
  })
})
