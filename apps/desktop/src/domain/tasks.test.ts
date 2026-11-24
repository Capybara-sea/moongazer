// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account, Tasks } from "./account"
import { activity } from "./activities"
import { gameDayOf } from "./gameTime"
import { STANDING_TASKS, type StandingTask } from "./standingTasks"
import {
  type CustomTask,
  EMPTY_TASKS,
  isPending,
  isValidCustomTask,
  parseTasksDoc,
  removeCustomTask,
  type StandingRow,
  saveCustomTask,
  type TaskRow,
  type TasksDoc,
  taskRows,
  toggleCheck,
  toggleJudging,
} from "./tasks"

/** A moment given in China time (UTC+8). */
const cst = (month: number, day: number, hour: number, minute = 0) =>
  Date.UTC(2026, month - 1, day, hour - 8, minute)
const day = (month: number, date: number) => gameDayOf(2026, month, date)

/** An account with only the given parts. Every value is made up. */
const account = (parts: Partial<Account> = {}): Account => ({
  characters: [],
  weapons: [],
  artifacts: [],
  materials: new Map(),
  characterInfo: new Map(),
  ...parts,
})
const withTasks = (tasks: Tasks, parts: Partial<Account> = {}) => account({ tasks, ...parts })

/** Friday 2026-11-20, 12:00. */
const NOW = cst(11, 20, 12)

function standingRow(task: StandingTask, source: Account, doc: TasksDoc = EMPTY_TASKS, now = NOW) {
  const row = taskRows(source, doc, now).find(r => r.id === task)
  if (row?.kind !== "standing") throw new Error(`no row for ${task}`)
  return row
}

const custom = (fields: Partial<CustomTask>): CustomTask => ({
  id: "fake",
  name: "Fake task",
  repeat: "daily",
  days: 1,
  startDay: day(11, 1),
  anchor: "start",
  note: "",
  ...fields,
})

/** The task's row; `doc` gets the task when it lacks it. */
function customRow(task: CustomTask, doc: TasksDoc, now = NOW) {
  const saved = doc.custom.some(t => t.id === task.id) ? doc : saveCustomTask(doc, task)
  const row = taskRows(account(), saved, now).find(r => r.id === `custom:${task.id}`)
  if (row?.kind !== "custom") throw new Error("no custom row")
  return row
}

describe("taskRows", () => {
  it("lists the running events, the standing tasks in order, then the player's own", () => {
    const source = account({
      events: [{ id: 5002, start: cst(11, 1, 4), end: cst(12, 1, 4) }],
    })
    const doc = saveCustomTask(EMPTY_TASKS, custom({}))
    expect(taskRows(source, doc, NOW).map(row => row.id)).toEqual([
      "event:5002",
      ...STANDING_TASKS,
      "custom:fake",
    ])
  })

  it("leaves everything the snapshot lacks not read and not done", () => {
    for (const row of taskRows(account(), EMPTY_TASKS, NOW)) {
      if (row.kind !== "standing") continue
      const byHand = ["battlePass", "reputation"].includes(row.task)
      expect(row.auto).toBe(byHand ? "manual" : "notRead")
      expect(row.done).toBe(false)
      expect(row.detail).toBeUndefined()
    }
  })
})

describe("events", () => {
  it("lists the running events by group, then by end, with tiers claimed of all", () => {
    const source = account({
      events: [
        { id: 5299, start: cst(11, 1, 4), end: cst(12, 1, 4) },
        { id: 5269, start: cst(11, 1, 4), end: cst(12, 20, 4) },
        { id: 5354, start: cst(11, 1, 4), end: cst(12, 2, 4), counters: [] },
        {
          id: 99_999_999,
          start: cst(11, 18, 10),
          end: cst(11, 25, 4),
          counters: [
            { progress: 1, total: 1, claimed: true },
            { progress: 2, total: 5, claimed: false },
          ],
        },
        { id: 5002, start: cst(11, 21, 4), end: cst(12, 1, 4) },
        { id: 5148, start: cst(10, 1, 4), end: cst(11, 20, 4) },
      ],
    })
    const rows = taskRows(source, EMPTY_TASKS, NOW).filter(row => row.kind === "event")
    expect(rows.map(row => [row.activityId, row.group, row.tag])).toEqual([
      [99_999_999, "limited", undefined],
      [5269, "challenge", undefined],
      [5354, "quest", "exploration"],
      [5299, "banner", undefined],
    ])
    expect(rows[0]).toMatchObject({
      name: null,
      progress: { claimed: 1, total: 2 },
      endsAt: cst(11, 25, 4),
      periodKey: String(day(11, 18)),
      auto: "notDone",
      judged: true,
      done: false,
    })
    expect(rows[1]?.name).toBe(activity(5269).name)
    expect(rows[2]?.progress).toBeUndefined()
    expect(rows[2]?.auto).toBe("manual")
  })

  it("counts an event done once every reward tier is claimed, unless judging is off", () => {
    const tier = { progress: 5, total: 5, claimed: true }
    const source = account({
      events: [{ id: 5352, start: cst(11, 19, 10), end: cst(12, 1, 4), counters: [tier, tier] }],
    })
    const row = taskRows(source, EMPTY_TASKS, NOW).find(r => r.id === "event:5352")
    if (row?.kind !== "event") throw new Error("no event row")
    expect(row).toMatchObject({ auto: "done", judged: true, done: true })
    const off = toggleJudging(EMPTY_TASKS, row)
    expect(off.manual).toEqual(["event:5352"])
    expect(off.checks).toEqual([
      { taskId: "event:5352", period: String(day(11, 19)), done: true, until: cst(12, 1, 4) },
    ])
    const again = taskRows(source, off, NOW).find(r => r.id === "event:5352")
    expect(again).toMatchObject({ judged: false, done: true })
    expect(parseTasksDoc(JSON.stringify(off)).manual).toEqual(["event:5352"])
  })
})

describe("ticks by hand", () => {
  /** The shop bought out this month: judged done. */
  const boughtOut = withTasks({
    bargains: {
      at: cst(11, 2, 12),
      fates: [{ item: "FakeFate", currency: "FakeDust", bought: 5, limit: 5 }],
    },
  })
  const month = String(day(11, 1))

  it("count for their own period only, and not on a row the snapshot judges", () => {
    const no: TasksDoc = {
      ...EMPTY_TASKS,
      checks: [{ taskId: "shop", period: month, done: false }],
    }
    expect(standingRow("shop", boughtOut, no)).toMatchObject({
      auto: "done",
      judged: true,
      done: true,
    })
    const yes: TasksDoc = {
      ...EMPTY_TASKS,
      checks: [{ taskId: "battlePass", period: String(day(11, 16)), done: true }],
    }
    expect(standingRow("battlePass", account(), yes)).toMatchObject({
      judged: false,
      done: true,
    })
    const nextWeek = cst(11, 23, 5)
    expect(standingRow("battlePass", account(), yes, nextWeek).done).toBe(false)
  })

  it("leave a row the snapshot judges alone, and are stored only as ticks", () => {
    const rows = taskRows(boughtOut, EMPTY_TASKS, NOW)
    const row = rows.find(r => r.id === "shop")
    if (!row) throw new Error("no row")
    expect(toggleCheck(EMPTY_TASKS, rows, row, NOW)).toBe(EMPTY_TASKS)
    const reputation = rows.find(r => r.id === "reputation")
    if (!reputation) throw new Error("no row")
    const ticked = toggleCheck(EMPTY_TASKS, rows, reputation, NOW)
    const week = String(day(11, 16))
    expect(ticked.checks).toEqual([{ taskId: "reputation", period: week, done: true }])
    const again = taskRows(boughtOut, ticked, NOW)
    const back = again.find(r => r.id === "reputation")
    if (!back) throw new Error("no row")
    expect(back.done).toBe(true)
    expect(toggleCheck(ticked, again, back, NOW).checks).toEqual([])
  })

  it("drop the ticks whose period is over", () => {
    const doc: TasksDoc = {
      ...EMPTY_TASKS,
      checks: [
        { taskId: "shop", period: String(day(10, 1)), done: true },
        { taskId: "event:5148", period: String(day(10, 1)), done: true, until: cst(11, 20, 4) },
        { taskId: "reputation", period: String(day(11, 16)), done: true },
      ],
    }
    const rows = taskRows(account(), doc, NOW)
    const pass = rows.find(r => r.id === "battlePass")
    if (!pass) throw new Error("no row")
    expect(toggleCheck(doc, rows, pass, NOW).checks).toEqual([
      { taskId: "reputation", period: String(day(11, 16)), done: true },
      { taskId: "battlePass", period: String(day(11, 16)), done: true },
    ])
  })

  it("keep an event's tick till it ends, even where the snapshot shown lacks the event", () => {
    const newest = account({ events: [{ id: 5352, start: cst(11, 19, 10), end: cst(12, 1, 4) }] })
    // Taken before the event began, so the export does not list it.
    const older = account()
    const toggle = (doc: TasksDoc, source: Account, id: string, now = NOW) => {
      const rows = taskRows(source, doc, now)
      const row = rows.find(r => r.id === id)
      if (!row) throw new Error(`no row for ${id}`)
      return toggleCheck(doc, rows, row, now)
    }
    const ticked = toggle(EMPTY_TASKS, newest, "event:5352")
    expect(ticked.checks).toEqual([
      { taskId: "event:5352", period: String(day(11, 19)), done: true, until: cst(12, 1, 4) },
    ])
    const elsewhere = toggle(ticked, older, "reputation")
    const event = taskRows(newest, elsewhere, NOW).find(r => r.id === "event:5352")
    expect(event?.done).toBe(true)
    const ended = cst(12, 1, 5)
    expect(toggle(elsewhere, older, "reputation", ended).checks).toEqual([
      { taskId: "reputation", period: String(day(11, 30)), done: true },
    ])
  })
})

describe("turning the snapshot's judging off", () => {
  const boughtOut = withTasks({
    bargains: {
      at: cst(11, 2, 12),
      fates: [{ item: "FakeFate", currency: "FakeDust", bought: 5, limit: 5 }],
    },
  })
  const month = String(day(11, 1))

  it("keeps what the snapshot said as this period's tick, then follows ticks", () => {
    const off = toggleJudging(EMPTY_TASKS, standingRow("shop", boughtOut))
    expect(off).toEqual({
      ...EMPTY_TASKS,
      manual: ["shop"],
      checks: [{ taskId: "shop", period: month, done: true }],
    })
    const row = standingRow("shop", boughtOut, off)
    expect(row).toMatchObject({ judged: false, done: true })
    const rows = taskRows(boughtOut, off, NOW)
    const unticked = toggleCheck(off, rows, row, NOW)
    expect(unticked.checks).toEqual([])
    expect(standingRow("shop", boughtOut, unticked).done).toBe(false)
    const nextMonth = cst(12, 1, 5)
    expect(standingRow("shop", boughtOut, off, nextMonth).judged).toBe(false)
  })

  it("starts not done where the snapshot said not done", () => {
    const pending = withTasks({
      bargains: {
        at: cst(11, 2, 12),
        fates: [{ item: "FakeFate", currency: "FakeDust", bought: 1, limit: 5 }],
      },
    })
    const off = toggleJudging(EMPTY_TASKS, standingRow("shop", pending))
    expect(off).toEqual({ ...EMPTY_TASKS, manual: ["shop"] })
  })

  it("turns back on, dropping the task's ticks", () => {
    const off = toggleJudging(EMPTY_TASKS, standingRow("shop", boughtOut))
    const back = toggleJudging(off, standingRow("shop", boughtOut, off))
    expect(back).toEqual(EMPTY_TASKS)
    expect(standingRow("shop", boughtOut, back)).toMatchObject({ judged: true, done: true })
  })

  it("is kept with the tasks, standing tasks only, each once", () => {
    // Tasks the to-do card no longer lists are dropped too.
    const text = JSON.stringify({
      manual: ["arRewards", "shop", "shop", "realm", "nope", 3, "event:7", "event:7", "event:x"],
    })
    expect(parseTasksDoc(text).manual).toEqual(["shop", "arRewards", "event:7"])
    expect(parseTasksDoc(JSON.stringify({ custom: [] })).manual).toEqual([])
  })

  it("keeps a tick on the Adventure Rank rewards till the rank goes up", () => {
    const rank = (ar: number) =>
      withTasks({ arRewards: Array.from({ length: ar - 1 }, (_, i) => i + 2) }, { player: { ar } })
    const off = toggleJudging(EMPTY_TASKS, standingRow("arRewards", rank(57)))
    expect(off.checks).toEqual([{ taskId: "arRewards", period: "ar57", done: true }])
    const nextWeek = cst(11, 27, 12)
    expect(standingRow("arRewards", rank(57), off, nextWeek).done).toBe(true)
    expect(standingRow("arRewards", rank(58), off, nextWeek).done).toBe(false)
  })
})

describe("the player's own tasks", () => {
  const tick = (doc: TasksDoc, task: CustomTask, now: number) =>
    toggleCheck(doc, taskRows(account(), doc, now), customRow(task, doc, now), now)

  it("repeat every period counted from the start day", () => {
    const task = custom({ repeat: "days", days: 3, startDay: day(11, 15) })
    const doc = saveCustomTask(EMPTY_TASKS, task)
    const row = customRow(task, doc)
    expect(row).toMatchObject({ periodKey: String(day(11, 18)), endsAt: cst(11, 21, 4) })
    const done = tick(doc, task, NOW)
    expect(customRow(task, done).done).toBe(true)
    expect(customRow(task, done, cst(11, 21, 3)).done).toBe(true)
    expect(customRow(task, done, cst(11, 21, 4)).done).toBe(false)
  })

  it("repeat weekly on the start day's weekday and daily at 04:00", () => {
    const weekly = custom({ repeat: "weekly", startDay: day(11, 4) })
    expect(customRow(weekly, EMPTY_TASKS)).toMatchObject({
      periodKey: String(day(11, 18)),
      endsAt: cst(11, 25, 4),
    })
    const daily = custom({})
    expect(customRow(daily, EMPTY_TASKS, cst(11, 21, 3))).toMatchObject({
      periodKey: String(day(11, 20)),
      endsAt: cst(11, 21, 4),
    })
  })

  it("wait for their start day, without counting as left to do", () => {
    const task = custom({ startDay: day(11, 25) })
    const row = customRow(task, saveCustomTask(EMPTY_TASKS, task))
    expect(row).toMatchObject({ done: false, startsAt: cst(11, 25, 4) })
    expect(row.endsAt).toBeUndefined()
    expect(isPending(row)).toBe(false)
  })

  it("come due a period after they were last done, when anchored to that", () => {
    const task = custom({ repeat: "days", days: 3, anchor: "done", startDay: day(11, 10) })
    const doc = saveCustomTask(EMPTY_TASKS, task)
    const due = customRow(task, doc)
    expect(due).toMatchObject({ done: false, periodKey: String(day(11, 20)) })
    expect(due.endsAt).toBeUndefined()
    expect(isPending(due)).toBe(true)
    const done = tick(doc, task, NOW)
    expect(customRow(task, done)).toMatchObject({ done: true, endsAt: cst(11, 23, 4) })
    expect(customRow(task, done, cst(11, 22, 12)).done).toBe(true)
    const again = customRow(task, done, cst(11, 23, 5))
    expect(again).toMatchObject({ done: false, periodKey: String(day(11, 23)) })
    expect(tick(done, task, NOW).checks).toEqual([])
  })

  it("are added, edited and removed with their ticks", () => {
    const task = custom({})
    const added = tick(saveCustomTask(EMPTY_TASKS, task), task, NOW)
    expect(added.checks).toHaveLength(1)
    const renamed = saveCustomTask(added, { ...task, name: "Renamed" })
    expect(renamed.custom).toEqual([{ ...task, name: "Renamed" }])
    const other = saveCustomTask(renamed, custom({ id: "other" }))
    expect(other.custom.map(t => t.id)).toEqual(["fake", "other"])
    const removed = removeCustomTask(other, "fake")
    expect(removed.custom.map(t => t.id)).toEqual(["other"])
    expect(removed.checks).toEqual([])
  })

  it("need a name, and a whole number of days for every N days", () => {
    expect(isValidCustomTask(custom({}))).toBe(true)
    expect(isValidCustomTask(custom({ name: "  " }))).toBe(false)
    expect(isValidCustomTask(custom({ repeat: "days", days: 0 }))).toBe(false)
    expect(isValidCustomTask(custom({ repeat: "days", days: 2.5 }))).toBe(false)
    expect(isValidCustomTask(custom({ repeat: "weekly", days: 0 }))).toBe(true)
  })
})

describe("parseTasksDoc", () => {
  it("reads nothing or unreadable text as no tasks", () => {
    expect(parseTasksDoc(null)).toEqual(EMPTY_TASKS)
    expect(parseTasksDoc("{")).toEqual(EMPTY_TASKS)
    expect(parseTasksDoc("[]")).toEqual(EMPTY_TASKS)
  })

  it("keeps the good entries and leaves out the rest", () => {
    const good = custom({ name: "Fake task", note: "A note" })
    const doc = parseTasksDoc(
      JSON.stringify({
        version: 1,
        custom: [
          { ...good, name: "  Fake task " },
          { ...good, name: "Duplicate id" },
          { ...good, id: "noName", name: "" },
          { ...good, id: "badRepeat", repeat: "monthly" },
          { ...good, id: "badDays", repeat: "days", days: 0 },
          { ...good, id: "badStart", startDay: "2026-11-20" },
          { ...good, id: "badAnchor", anchor: "end" },
          { id: "bare", name: "Bare", repeat: "weekly", startDay: 5, anchor: "done" },
          "task",
        ],
        checks: [
          { taskId: "commissions", period: "20412", done: true },
          { taskId: "event:5352", period: "20411", done: true, until: 1_800_000_000_000 },
          { taskId: "event:5299", period: "20411", done: true, until: "soon" },
          { taskId: "commissions", period: 20412, done: true },
          { taskId: "realm", period: "20412", done: "yes" },
          null,
        ],
      }),
    )
    expect(doc.custom).toEqual([
      good,
      {
        id: "bare",
        name: "Bare",
        repeat: "weekly",
        days: 1,
        startDay: 5,
        anchor: "done",
        note: "",
      },
    ])
    expect(doc.checks).toEqual([
      { taskId: "commissions", period: "20412", done: true },
      { taskId: "event:5352", period: "20411", done: true, until: 1_800_000_000_000 },
      { taskId: "event:5299", period: "20411", done: true },
    ])
  })

  it("reads back what it saved", () => {
    const doc = saveCustomTask(EMPTY_TASKS, custom({ repeat: "days", days: 4 }))
    expect(parseTasksDoc(JSON.stringify(doc))).toEqual(doc)
  })
})

describe("isPending", () => {
  it("counts the rows not done", () => {
    const rows: TaskRow[] = taskRows(account(), EMPTY_TASKS, NOW)
    const standing = rows.filter((row): row is StandingRow => row.kind === "standing")
    expect(standing.filter(isPending)).toHaveLength(STANDING_TASKS.length)
  })
})
