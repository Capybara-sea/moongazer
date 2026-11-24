// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { ACTIVITY_GROUPS } from "@/domain/activities"
import { STANDING_TASKS } from "@/domain/standingTasks"
import type { CustomRow, EventRow, StandingRow, TaskRow } from "@/domain/tasks"
import {
  inTab,
  isShown,
  onTodo,
  type Prefs,
  parseHidden,
  tabCounts,
  withHidden,
} from "./taskFilter"

const base = { periodKey: "1", auto: "manual", judged: false, done: false } as const

const standing = (done = false): StandingRow => ({
  ...base,
  kind: "standing",
  id: "shop",
  task: "shop",
  period: "monthly",
  done,
})
const event = (done = false): EventRow => ({
  ...base,
  kind: "event",
  id: "event:1",
  activityId: 1,
  name: null,
  group: "gcg",
  endsAt: 0,
  done,
})
const custom = (startsAt?: number): CustomRow => ({
  ...base,
  kind: "custom",
  id: "custom:fake",
  custom: {
    id: "fake",
    name: "Fake task",
    repeat: "daily",
    days: 1,
    startDay: 0,
    anchor: "start",
    note: "",
  },
  startsAt,
})

const prefs = (fields: Partial<Prefs> = {}): Prefs => ({
  hideDone: false,
  hiddenTasks: new Set(),
  hiddenGroups: new Set(),
  ...fields,
})

describe("stored switches", () => {
  it("keeps only the ids it knows", () => {
    expect([...parseHidden('["shop","abyss","nope",3]', STANDING_TASKS)]).toEqual(["shop"])
    expect([...parseHidden('["gcg"]', ACTIVITY_GROUPS)]).toEqual(["gcg"])
  })

  it("hides nothing when nothing readable is stored", () => {
    expect(parseHidden(null, STANDING_TASKS).size).toBe(0)
    expect(parseHidden("not json", STANDING_TASKS).size).toBe(0)
    expect(parseHidden('{"shop":true}', STANDING_TASKS).size).toBe(0)
  })

  it("puts an id in or out", () => {
    const hidden = withHidden(new Set(["shop"]), "reputation", true)
    expect([...hidden]).toEqual(["shop", "reputation"])
    expect([...withHidden(hidden, "shop", false)]).toEqual(["reputation"])
  })
})

describe("what the to-do card shows", () => {
  it("hides standing tasks by task and events by group, never custom tasks", () => {
    const off = prefs({ hiddenTasks: new Set(["shop"]), hiddenGroups: new Set(["gcg"]) })
    expect(isShown(standing(), off)).toBe(false)
    expect(isShown(event(), off)).toBe(false)
    expect(isShown(custom(), off)).toBe(true)
    expect(isShown(standing(), prefs())).toBe(true)
  })

  it("puts each kind under its tab and every row under all", () => {
    expect(inTab(standing(), "standing")).toBe(true)
    expect(inTab(event(), "events")).toBe(true)
    expect(inTab(custom(), "custom")).toBe(true)
    expect(inTab(event(), "standing")).toBe(false)
    expect(inTab(custom(), "all")).toBe(true)
  })

  it("counts what is still to do in each tab", () => {
    const rows: TaskRow[] = [standing(), standing(true), event(), custom(), custom(1)]
    expect(tabCounts(rows)).toEqual({ all: 3, standing: 1, events: 1, custom: 1 })
  })
})

describe("what the to-do card lists", () => {
  it("lists all but the Stygian Onslaught's event, which the challenge card shows", () => {
    const stygian: EventRow = { ...event(), id: "event:5269", activityId: 5269, group: "challenge" }
    expect(onTodo(stygian)).toBe(false)
    expect(onTodo(standing())).toBe(true)
    expect(onTodo(event())).toBe(true)
    expect(onTodo(custom())).toBe(true)
  })
})
