// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The overview's tasks: the events running, the standing tasks and the
 * player's own, each with the period a tick by hand counts for. A standing
 * task the snapshot can judge follows it, unless the player turns that off for
 * the task; then, like the rest, it follows ticks by hand. Days are game days,
 * turning at 04:00 UTC+8.
 */

import type { Account } from "@/domain/account"
import {
  ACTIVITY_GROUPS,
  type ActivityGroup,
  type ActivityTag,
  activity,
} from "@/domain/activities"
import { gameDay, gameDayStart } from "@/domain/gameTime"
import { num, record, str } from "@/domain/json"
import {
  type Auto,
  type Period,
  STANDING_TASKS,
  type StandingDetail,
  type StandingTask,
  standing,
} from "@/domain/standingTasks"

export const REPEATS = ["daily", "weekly", "days"] as const
export type Repeat = (typeof REPEATS)[number]
export const ANCHORS = ["start", "done"] as const
export type Anchor = (typeof ANCHORS)[number]
export const MAX_REPEAT_DAYS = 365

export type CustomTask = {
  id: string
  name: string
  repeat: Repeat
  /** The N of every N days; kept under the other repeats too. */
  days: number
  /** The game day it starts on, as `gameDay` counts them. */
  startDay: number
  /**
   * "start": due again every period counted from the start day; "done": due
   * again a period after the day it was last done.
   */
  anchor: Anchor
  note: string
}

/**
 * A tick by hand: `period` is the row's `periodKey` when it was made. One with
 * `until` counts till then whatever the period: an event's till the event
 * ends, as a snapshot taken before it began has no row for it.
 */
export type ManualCheck = { taskId: string; period: string; done: boolean; until?: number }

export type TasksDoc = {
  version: 1
  custom: CustomTask[]
  checks: ManualCheck[]
  /**
   * The rows the player ticks by hand, though the snapshot could judge them:
   * standing tasks by name, events as `event:<activity id>`.
   */
  manual: string[]
}

export const EMPTY_TASKS: TasksDoc = { version: 1, custom: [], checks: [], manual: [] }

type Base = {
  /** The standing task, `event:<activity id>` or `custom:<id>`; ticks are kept by it. */
  id: string
  /** The period now, as a tick records it: the game day it began. */
  periodKey: string
  auto: Auto
}
type Ticked = {
  /** Whether the snapshot's judgement stands, which locks the tick: it has one, not turned off. */
  judged: boolean
  done: boolean
}

export type StandingRow = Base &
  Ticked & {
    kind: "standing"
    task: StandingTask
    period: Period
    /** When this period ends; none for tasks that never start over by themselves. */
    endsAt?: number
    /** Missing when the snapshot did not have it. */
    detail?: StandingDetail
  }

export type EventRow = Base &
  Ticked & {
    kind: "event"
    activityId: number
    /** Null when the bundled data has no name for it. */
    name: string | null
    group: ActivityGroup
    tag?: ActivityTag
    /** Reward tiers claimed of all; missing for an event without tiers. */
    progress?: { claimed: number; total: number }
    endsAt: number
  }

export type CustomRow = Base &
  Ticked & {
    kind: "custom"
    custom: CustomTask
    /** When it starts, while it has not. */
    startsAt?: number
    /** When this period ends, or when a task done is due again; none while it is due. */
    endsAt?: number
  }

export type TaskRow = StandingRow | EventRow | CustomRow

/** Days between repeats. */
export function repeatDays(task: CustomTask) {
  return task.repeat === "daily" ? 1 : task.repeat === "weekly" ? 7 : task.days
}

/** Every row at `now`, in the to-do card's order: the events, the standing tasks, the player's own. */
export function taskRows(account: Account, doc: TasksDoc, now: number): TaskRow[] {
  const manual: readonly string[] = doc.manual
  const tick = <T extends Base>(row: T): T & Ticked => {
    const judged = (row.auto === "done" || row.auto === "notDone") && !manual.includes(row.id)
    if (judged) return { ...row, judged, done: row.auto === "done" }
    const check = doc.checks.find(
      c =>
        c.taskId === row.id && (c.until === undefined ? c.period === row.periodKey : now < c.until),
    )
    return { ...row, judged, done: check?.done ?? false }
  }
  const events = (account.events ?? [])
    .filter(event => event.start <= now && now < event.end)
    .map(({ id, start, end, counters }) => {
      const { name, group, tag } = activity(id)
      const progress = counters?.length
        ? { claimed: counters.filter(c => c.claimed).length, total: counters.length }
        : undefined
      return tick<Omit<EventRow, keyof Ticked>>({
        kind: "event",
        id: `event:${id}`,
        periodKey: String(gameDay(start)),
        // An event with reward tiers is done once every tier is claimed; one without is ticked by hand.
        auto: progress ? (progress.claimed >= progress.total ? "done" : "notDone") : "manual",
        activityId: id,
        name,
        group,
        tag,
        progress,
        endsAt: end,
      })
    })
    .sort(
      (a, b) =>
        ACTIVITY_GROUPS.indexOf(a.group) - ACTIVITY_GROUPS.indexOf(b.group) ||
        a.endsAt - b.endsAt ||
        a.activityId - b.activityId,
    )
  const standings = STANDING_TASKS.map(task => {
    const { start, key, ...rest } = standing(task, account, now)
    return tick<Omit<StandingRow, keyof Ticked>>({
      kind: "standing",
      id: task,
      periodKey: key ?? String(gameDay(start)),
      task,
      ...rest,
    })
  })
  const custom = doc.custom.map(task => tick(customRow(task, doc.checks, now)))
  return [...events, ...standings, ...custom]
}

function customRow(task: CustomTask, checks: ManualCheck[], now: number) {
  const id = `custom:${task.id}`
  const row = { kind: "custom", id, auto: "manual", custom: task } as const
  const today = gameDay(now)
  const every = repeatDays(task)
  if (today < task.startDay) {
    return { ...row, periodKey: String(task.startDay), startsAt: gameDayStart(task.startDay) }
  }
  if (task.anchor === "start") {
    const from = task.startDay + Math.floor((today - task.startDay) / every) * every
    return { ...row, periodKey: String(from), endsAt: gameDayStart(from + every) }
  }
  // Done-anchored ticks record the day they were made, and stay until then plus a period.
  let last: number | undefined
  for (const check of checks) {
    const day = Number(check.period)
    if (check.taskId === id && check.done && Number.isInteger(day) && (last ?? day) <= day) {
      last = day
    }
  }
  if (last !== undefined && today < last + every) {
    return { ...row, periodKey: String(last), endsAt: gameDayStart(last + every) }
  }
  return { ...row, periodKey: String(today) }
}

/** Not done and due: what the to-do card's tabs and the home page's count count. */
export function isPending(row: TaskRow) {
  return !row.done && !(row.kind === "custom" && row.startsAt !== undefined)
}

/**
 * Ticks or unticks a row by hand for its period now; a row the snapshot
 * judges stays as it is. Only ticks are kept, as a row not judged is not done
 * without one, and ticks no longer counting are dropped: those with `until`
 * once it has passed, the others once no row of `rows` (all of `taskRows`)
 * still has a use for them.
 */
export function toggleCheck(
  doc: TasksDoc,
  rows: readonly TaskRow[],
  row: TaskRow,
  now: number,
): TasksDoc {
  if (row.judged) return doc
  const checks = doc.checks.filter(
    check =>
      check.taskId !== row.id &&
      (check.until === undefined
        ? rows.some(r => r.id === check.taskId && r.periodKey === check.period)
        : now < check.until),
  )
  if (!row.done) checks.push(tickOf(row))
  return { ...doc, checks }
}

/**
 * Turns the snapshot's judging of a standing task or an event off, keeping
 * what it said as this period's tick, or back on, dropping the row's ticks.
 */
export function toggleJudging(doc: TasksDoc, row: StandingRow | EventRow): TasksDoc {
  const checks = doc.checks.filter(check => check.taskId !== row.id)
  if (doc.manual.includes(row.id)) {
    return { ...doc, manual: doc.manual.filter(id => id !== row.id), checks }
  }
  if (row.auto === "done") checks.push(tickOf(row))
  return { ...doc, manual: [...doc.manual, row.id], checks }
}

/** A tick of `row`: an event's lasts till the event ends. */
function tickOf(row: TaskRow): ManualCheck {
  const check = { taskId: row.id, period: row.periodKey, done: true }
  return row.kind === "event" ? { ...check, until: row.endsAt } : check
}

/** Adds the task, or puts it in place of the one with its id. */
export function saveCustomTask(doc: TasksDoc, task: CustomTask): TasksDoc {
  const at = doc.custom.findIndex(t => t.id === task.id)
  return { ...doc, custom: at < 0 ? [...doc.custom, task] : doc.custom.with(at, task) }
}

/** Removes the task and its ticks. */
export function removeCustomTask(doc: TasksDoc, id: string): TasksDoc {
  return {
    ...doc,
    custom: doc.custom.filter(task => task.id !== id),
    checks: doc.checks.filter(check => check.taskId !== `custom:${id}`),
  }
}

/** Whether a task would be kept as saved: it has a name, and N fits for every N days. */
export function isValidCustomTask(task: CustomTask) {
  return parseCustomTask(task) !== undefined
}

const isDays = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_REPEAT_DAYS

function parseCustomTask(value: unknown): CustomTask | undefined {
  const raw = record(value) ?? {}
  const id = str(raw.id)
  const name = str(raw.name)?.trim()
  const repeat = REPEATS.find(r => r === raw.repeat)
  const anchor = ANCHORS.find(a => a === raw.anchor)
  const { startDay, days } = raw
  if (!id || !name || !repeat || !anchor || !Number.isInteger(startDay)) return undefined
  if (repeat === "days" && !isDays(days)) return undefined
  return {
    id,
    name,
    repeat,
    days: isDays(days) ? days : 1,
    startDay: Number(startDay),
    anchor,
    note: str(raw.note) ?? "",
  }
}

/** The saved tasks; what does not check out is left out. */
export function parseTasksDoc(text: string | null): TasksDoc {
  if (text === null) return EMPTY_TASKS
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    // Unreadable text counts as no tasks.
    return EMPTY_TASKS
  }
  const raw = record(value) ?? {}
  const custom: CustomTask[] = []
  for (const item of Array.isArray(raw.custom) ? raw.custom : []) {
    const task = parseCustomTask(item)
    if (task && !custom.some(t => t.id === task.id)) custom.push(task)
  }
  const checks = (Array.isArray(raw.checks) ? raw.checks : []).flatMap(item => {
    const check = record(item)
    const taskId = str(check?.taskId)
    const period = str(check?.period)
    const done = check?.done
    if (!taskId || !period || typeof done !== "boolean") return []
    const until = num(check?.until)
    return [until === undefined ? { taskId, period, done } : { taskId, period, done, until }]
  })
  const listed: unknown[] = Array.isArray(raw.manual) ? raw.manual : []
  const manual = [
    ...STANDING_TASKS.filter(task => listed.includes(task)),
    ...new Set(listed.filter(id => typeof id === "string" && /^event:\d+$/.test(id)) as string[]),
  ]
  return { version: 1, custom, checks, manual }
}
