// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { gameDate, gameDayOf, gameDayStart } from "@/domain/gameTime"
import { lookup } from "@/domain/names"
import type { StandingDetail } from "@/domain/standingTasks"
import type { CustomTask, TaskRow } from "@/domain/tasks"
import { text } from "@/text"

const t = text.tasks
const MINUTE = 60_000
const HOUR_MINUTES = 60
const DAY_MINUTES = 24 * HOUR_MINUTES

/**
 * Time left: days and hours from a day on, hours and minutes from an hour on,
 * else minutes. Rounded up to the minute, so it never reads 0 before the time.
 */
export function formatCountdown(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / MINUTE))
  if (minutes >= DAY_MINUTES) {
    const hours = Math.floor((minutes % DAY_MINUTES) / HOUR_MINUTES)
    return t.countdown.days(Math.floor(minutes / DAY_MINUTES), hours)
  }
  if (minutes >= HOUR_MINUTES) {
    return t.countdown.hours(Math.floor(minutes / HOUR_MINUTES), minutes % HOUR_MINUTES)
  }
  return t.countdown.minutes(minutes)
}

export function rowName(row: TaskRow) {
  switch (row.kind) {
    case "standing":
      return t.standing[row.task]
    case "event":
      return row.name ?? t.eventUnnamed(row.activityId)
    case "custom":
      return row.custom.name
  }
}

/** The line under a row's name; none when there is nothing to say. */
export function rowDetail(row: TaskRow): string | undefined {
  switch (row.kind) {
    case "standing":
      if (row.auto === "notRead") return text.snapshot.notRead
      return row.detail && standingDetail(row.detail)
    case "event":
      return row.progress && t.detail.count(row.progress.claimed, row.progress.total)
    case "custom":
      return customDetail(row.custom, row.startsAt)
  }
}

function standingDetail(detail: StandingDetail) {
  const d = t.detail
  switch (detail.task) {
    case "shop":
      return detail.fates
        .map(fate => d.fate(lookup("materials", fate.item).name, fate.bought, fate.limit))
        .join(d.separator)
    case "arRewards":
      return d.arRewards(detail.claimable)
  }
}

/** How often a task repeats, and whether that counts from the day it was done. */
export function repeatText(task: CustomTask) {
  const every = task.repeat === "days" ? t.repeat.days(task.days) : t.repeat[task.repeat]
  return task.anchor === "done" ? `${every}${t.byDone}` : every
}

function customDetail(task: CustomTask, startsAt: number | undefined) {
  const parts = [repeatText(task)]
  if (startsAt !== undefined) {
    const { month, day } = gameDate(startsAt)
    parts.push(t.startsOn(month, day))
  }
  if (task.note) parts.push(task.note)
  return parts.join(t.detail.separator)
}

/**
 * What a row counts down to: the end of its period or an event's end; none
 * for a task that never starts over by itself, nor a task not started.
 */
export function rowCountdown(row: TaskRow): number | undefined {
  if (row.kind === "custom") return row.startsAt === undefined ? row.endsAt : undefined
  return row.endsAt
}

const pad = (n: number) => String(n).padStart(2, "0")

/** A game day as a date field holds it: "2026-11-20". */
export function dayInput(day: number) {
  const { year, month, day: date } = gameDate(gameDayStart(day))
  return `${year}-${pad(month)}-${pad(date)}`
}

/** The game day a date field holds; none when it holds no date. */
export function parseDayInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  return gameDayOf(Number(match[1]), Number(match[2]), Number(match[3]))
}
