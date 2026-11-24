// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import { ACTIVITY_GROUPS, type ActivityGroup, activity } from "@/domain/activities"
import { STANDING_TASKS, type StandingTask } from "@/domain/standingTasks"
import { isPending, type TaskRow } from "@/domain/tasks"
import { readStored, writeStored } from "@/lib/storage"

/** The Stygian Onslaught's event type, which the challenge card shows. */
const STYGIAN = "LEY_LINE_CHALLENGE"

/** Whether the to-do card lists a row: all but the Stygian Onslaught's event. */
export function onTodo(row: TaskRow) {
  return row.kind !== "event" || activity(row.activityId).type !== STYGIAN
}

export const TABS = ["all", "standing", "events", "custom"] as const
export type Tab = (typeof TABS)[number]

/** What the to-do card leaves out; the same for every account. */
export type Prefs = {
  hideDone: boolean
  hiddenTasks: ReadonlySet<StandingTask>
  hiddenGroups: ReadonlySet<ActivityGroup>
}

const KEYS = {
  hideDone: "moongazer:tasks:hideDone",
  hiddenTasks: "moongazer:tasks:hiddenTasks",
  hiddenGroups: "moongazer:tasks:hiddenGroups",
}

/** The ids of `all` in a stored list; anything else in it is dropped. */
export function parseHidden<T extends string>(stored: string | null, all: readonly T[]): Set<T> {
  let value: unknown
  try {
    value = JSON.parse(stored ?? "[]")
  } catch {
    // Unreadable: nothing hidden.
    return new Set()
  }
  const ids: unknown[] = Array.isArray(value) ? value : []
  return new Set(all.filter(id => ids.includes(id)))
}

function readPrefs(): Prefs {
  return {
    hideDone: readStored(KEYS.hideDone) === "true",
    hiddenTasks: parseHidden(readStored(KEYS.hiddenTasks), STANDING_TASKS),
    hiddenGroups: parseHidden(readStored(KEYS.hiddenGroups), ACTIVITY_GROUPS),
  }
}

/** Read once and shared, so the home page's count follows the to-do card's switches. */
const usePrefsStore = create<{ prefs: Prefs }>(() => ({ prefs: readPrefs() }))

function changePrefs(next: Prefs) {
  usePrefsStore.setState({ prefs: next })
  writeStored(KEYS.hideDone, String(next.hideDone))
  writeStored(KEYS.hiddenTasks, JSON.stringify([...next.hiddenTasks]))
  writeStored(KEYS.hiddenGroups, JSON.stringify([...next.hiddenGroups]))
}

/** The to-do card's preferences, saved in this browser as they change. */
export function useTodoPrefs() {
  return [usePrefsStore(s => s.prefs), changePrefs] as const
}

/** `set` with `id` in or out. */
export function withHidden<T>(set: ReadonlySet<T>, id: T, hidden: boolean) {
  const next = new Set(set)
  if (hidden) next.add(id)
  else next.delete(id)
  return next
}

/** Whether the shown tasks switches have a row on: by its standing task or its event's group. */
export function isShown(row: TaskRow, prefs: Prefs) {
  if (row.kind === "standing") return !prefs.hiddenTasks.has(row.task)
  if (row.kind === "event") return !prefs.hiddenGroups.has(row.group)
  return true
}

const TAB_KINDS = { standing: "standing", events: "event", custom: "custom" } as const

export function inTab(row: TaskRow, tab: Tab) {
  return tab === "all" || row.kind === TAB_KINDS[tab]
}

/** Each tab's rows still to do, of `rows`. */
export function tabCounts(rows: readonly TaskRow[]) {
  const counts: Record<Tab, number> = { all: 0, standing: 0, events: 0, custom: 0 }
  for (const row of rows) {
    if (!isPending(row)) continue
    for (const tab of TABS) if (inTab(row, tab)) counts[tab]++
  }
  return counts
}
