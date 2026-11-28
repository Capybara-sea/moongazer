// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { CaptureStatus } from "@/lib/backend/sync"
import { formatDuration, formatTime, formatWhen } from "@/lib/format"
import { text } from "@/text"
import { leftOutText } from "./leftOut"
import {
  actionsOf,
  cardView,
  connectionOf,
  loginSettled,
  problemNote,
  stepsOf,
  summaryText,
} from "./states"

const t = text.sync
const LOGIN = new Date(2026, 10, 18, 20, 1).getTime()
const NOW = LOGIN + 72 * 60_000

const off: CaptureStatus = {
  phase: "off",
  helper: "off",
  server: null,
  entered: false,
  account: null,
  loginAt: null,
  lostAt: null,
  settled: false,
  savedAt: null,
  compatible: false,
  problem: null,
}
const waitingGame: CaptureStatus = { ...off, phase: "waitingGame", helper: "running" }
const waitingLogin: CaptureStatus = { ...waitingGame, phase: "waitingLogin", server: "china" }
const connected: CaptureStatus = {
  ...waitingLogin,
  phase: "connected",
  entered: true,
  account: { nickname: "Fake", uid: 100000001, adventureRank: 60 },
  loginAt: LOGIN,
  settled: true,
  savedAt: LOGIN + 60_000,
}
const lostAt = LOGIN + 65 * 60_000
const interrupted: CaptureStatus = {
  ...connected,
  phase: "interrupted",
  helper: "exited",
  entered: false,
  lostAt,
  problem: { kind: "helperExited" },
}
const retrying = { problem: { kind: "captureFailed" }, helper: "retrying" } as const

const looks = (status: CaptureStatus) => stepsOf(status).map(s => [s.look, s.detail])

describe("cardView", () => {
  it("tells each state apart by its label and color", () => {
    expect(cardView(off, 0, null, NOW)).toEqual({
      label: t.phases.off,
      tone: "idle",
      duration: null,
      lines: t.card.off,
    })
    expect(cardView(waitingGame, 0, null, NOW).lines).toEqual(t.card.waitingGame)
    expect(cardView({ ...waitingGame, helper: "starting" }, 0, null, NOW).lines).toEqual(
      t.card.helperStarting,
    )
    expect(cardView({ ...waitingGame, ...retrying }, 0, null, NOW).lines).toEqual(t.card.retrying)
    expect(cardView(waitingLogin, 0, null, NOW).tone).toBe("warn")
    expect(cardView(interrupted, 0, null, NOW)).toMatchObject({
      tone: "bad",
      duration: null,
      lines: [t.causes.helperExited, t.card.look],
    })
  })

  it("shows who is connected, for how long and how many change lines the panel lists", () => {
    const changedAt = NOW - 30_000
    expect(cardView(connected, 5, changedAt, NOW)).toEqual({
      label: t.phases.connected,
      tone: "ok",
      duration: formatDuration(72 * 60_000),
      lines: [`Fake · ${t.servers.china}`, t.card.updated(formatWhen(changedAt, NOW), 5)],
    })
    expect(cardView(connected, 0, null, NOW).lines[1]).toBe(t.card.synced)
    expect(cardView({ ...connected, settled: false }, 0, null, NOW).lines[1]).toBe(t.card.reading)
  })

  it("never shows the same line twice before the account is known", () => {
    const early = { ...connected, settled: false, account: null, server: null }
    expect(cardView(early, 0, null, NOW).lines).toEqual([t.card.entered, t.card.reading])
  })

  it("puts what to do about a problem on the card", () => {
    expect(cardView({ ...off, problem: { kind: "declined" } }, 0, null, NOW).lines).toEqual(
      t.card.declined,
    )
    expect(cardView({ ...off, problem: { kind: "updateFailed" } }, 0, null, NOW).lines).toEqual(
      t.card.updateFailed,
    )
    const relogin = { ...waitingLogin, problem: { kind: "keyLost" } } as const
    expect(cardView(relogin, 0, null, NOW).lines).toEqual(t.card.relogin)
    const outdated = { ...waitingLogin, problem: { kind: "packOutdated" } } as const
    expect(cardView(outdated, 0, null, NOW).lines).toEqual(t.card.outdated)
  })
})

describe("the panel", () => {
  it("walks the four steps along the way to live sync", () => {
    const none = t.detail.none
    expect(looks(off)).toEqual([
      ["idle", none],
      ["idle", none],
      ["idle", none],
      ["idle", none],
    ])
    expect(looks({ ...off, phase: "starting" })[0]).toEqual(["wait", t.detail.starting])
    expect(looks(waitingGame)).toEqual([
      ["done", t.detail.running],
      ["wait", t.detail.waitGame],
      ["idle", none],
      ["idle", none],
    ])
    expect(looks(waitingLogin).slice(1, 3)).toEqual([
      ["done", t.servers.china],
      ["wait", t.detail.waitLogin],
    ])
    expect(looks(connected)[3]).toEqual(["done", t.detail.syncing])
    expect(looks(interrupted)).toEqual([
      ["err", t.detail.exited],
      ["done", t.servers.china],
      ["done", t.detail.entered],
      ["idle", t.detail.stoppedAt(formatTime(lostAt))],
    ])
  })

  it("says when the connection stopped and for how long it ran", () => {
    expect(summaryText(interrupted)).toBe(
      t.summary.interrupted(t.causes.helperExited, formatTime(lostAt)),
    )
    expect(connectionOf(connected, NOW)).toEqual({
      value: formatDuration(72 * 60_000),
      since: t.loggedInAt(formatTime(LOGIN)),
    })
    expect(connectionOf(interrupted, NOW)).toEqual({
      value: formatDuration(65 * 60_000),
      since: t.lostAt(formatTime(lostAt)),
    })
    expect(connectionOf(off, NOW)).toBeNull()
  })

  it("says a retry once, in the summary, and not as a note too", () => {
    for (const status of [waitingGame, waitingLogin]) {
      const failing = { ...status, ...retrying }
      expect(summaryText(failing)).toBe(t.summary.retrying)
      expect(problemNote(failing)).toBeNull()
    }
  })

  it("keeps saying retrying while each retry starts the helper again", () => {
    for (const status of [waitingGame, waitingLogin]) {
      const again = { ...status, ...retrying, helper: "starting" } as const
      expect(cardView(again, 0, null, NOW).lines).toEqual(t.card.retrying)
      expect(summaryText(again)).toBe(t.summary.retrying)
      expect(problemNote(again)).toBeNull()
      expect(looks(again)[0]).toEqual(["wait", t.detail.retrying])
    }
    expect(looks({ ...waitingGame, ...retrying, helper: "starting" })[1]).toEqual([
      "wait",
      t.detail.waitGame,
    ])
  })

  it("does not promise sync on entering Teyvat before Moongazer is updated", () => {
    const outdated = { ...waitingLogin, problem: { kind: "packOutdated" } } as const
    expect(summaryText(outdated)).toBe(t.summary.gameRunning)
    expect(problemNote(outdated)).toBe(t.notes.packOutdated)
  })

  it("asks to go back to the title screen once, in the note when there is one", () => {
    expect(summaryText(waitingLogin)).toBe(t.summary.waitingLogin)
    const relogin = { ...waitingLogin, problem: { kind: "alreadyInGame" } } as const
    expect(summaryText(relogin)).toBe(t.summary.entering)
    expect(problemNote(relogin)).toBe(t.notes.alreadyInGame)
  })

  it("notes a problem once, not again under an interruption", () => {
    const leftOut = "unknown_weapon: 2"
    const outdated = { ...connected, problem: { kind: "dataOutdated", leftOut } } as const
    expect(problemNote(outdated)).toBe(t.notes.dataOutdated(leftOutText(leftOut)))
    expect(problemNote({ ...off, problem: { kind: "declined" } })).toBe(t.notes.declined)
    expect(problemNote({ ...off, problem: { kind: "updateFailed" } })).toBe(t.notes.updateFailed)
    expect(problemNote(interrupted)).toBeNull()
    expect(problemNote(connected)).toBeNull()
  })

  it("offers the buttons each state needs", () => {
    expect(actionsOf(off)).toEqual({ primary: "start", secondary: [], note: t.startNote })
    expect(actionsOf({ ...off, problem: { kind: "launchFailed" } }).secondary).toEqual(["openLog"])
    expect(actionsOf(waitingLogin).primary).toBe("stop")
    expect(actionsOf(connected)).toMatchObject({ primary: "saveNow", secondary: ["stop"] })
    expect(actionsOf(interrupted)).toMatchObject({
      primary: "restart",
      secondary: ["stop", "openLog"],
    })
  })
})

describe("loginSettled", () => {
  it("is true once when a login settles, also after one left for another account", () => {
    expect(loginSettled(waitingLogin, connected)).toBe(true)
    expect(loginSettled(connected, { ...connected, savedAt: NOW })).toBe(false)
    // Back to the title screen and into another account in the same game.
    const relogging = { ...connected, settled: false, account: null }
    expect(loginSettled(connected, relogging)).toBe(false)
    expect(loginSettled(relogging, connected)).toBe(true)
  })

  it("is not when the status is first read", () => {
    expect(loginSettled(null, connected)).toBe(false)
  })
})
