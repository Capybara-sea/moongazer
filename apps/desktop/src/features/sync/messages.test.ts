// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Snapshot } from "@/lib/backend"
import type { CaptureStatus } from "@/lib/backend/sync"
import { text } from "@/text/zh"
import { reviewMessage, statusMessages } from "./messages"

const m = text.messages
const NOW = new Date(2026, 10, 18, 21, 13).getTime()
const VERSION = "0.6.0"

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
const waitingLogin: CaptureStatus = { ...off, phase: "waitingLogin", helper: "running" }
const connected: CaptureStatus = {
  ...waitingLogin,
  phase: "connected",
  entered: true,
  loginAt: NOW - 3_600_000,
  settled: true,
}
const interrupted: CaptureStatus = {
  ...connected,
  phase: "interrupted",
  helper: "exited",
  entered: false,
  lostAt: NOW - 60_000,
  problem: { kind: "helperExited" },
}

const messages = (before: CaptureStatus | null, after: CaptureStatus) =>
  statusMessages(before, after, NOW, VERSION)

describe("statusMessages", () => {
  it("records an interruption once, as a problem worth a notification", () => {
    const [message, ...rest] = messages(connected, interrupted)
    expect(rest).toEqual([])
    expect(message).toMatchObject({ kind: "danger", page: "sync", title: m.syncInterrupted })
    expect(messages(interrupted, interrupted)).toEqual([])
  })

  it("asks to log in again when that problem starts", () => {
    const relogin = { ...waitingLogin, problem: { kind: "alreadyInGame" } } as const
    expect(messages(waitingLogin, relogin)).toMatchObject([
      { kind: "danger", title: m.syncRelogin, body: text.sync.notes.alreadyInGame },
    ])
    expect(messages(relogin, relogin)).toEqual([])
    expect(messages(null, { ...off, problem: { kind: "declined" } })).toEqual([])
  })

  it("asks for an update as a notification, once per app version or list left out", () => {
    const pack = { ...waitingLogin, problem: { kind: "packOutdated" } } as const
    const first = messages(waitingLogin, pack)
    expect(first).toMatchObject([{ kind: "danger", title: m.syncOutdated }])
    // Asked again with the same id, so the message center keeps the first only.
    expect(messages(pack, pack)).toEqual(first)
    expect(statusMessages(waitingLogin, pack, NOW, "0.6.1")[0]?.id).not.toBe(first[0]?.id)
    // Not keyed by a version not read yet, which would hold back every later version's.
    expect(statusMessages(waitingLogin, pack, NOW, null)).toEqual([])

    const data = (leftOut: string) =>
      ({ ...connected, problem: { kind: "dataOutdated", leftOut } }) as const
    const [weapons] = messages(connected, data("unknown_weapon: 2"))
    expect(weapons).toMatchObject({ kind: "danger", title: m.syncOutdated })
    expect(statusMessages(connected, data("unknown_weapon: 2"), NOW + 1, VERSION)[0]?.id).toBe(
      weapons?.id,
    )
    expect(messages(connected, data("unknown_weapon: 3"))[0]?.id).not.toBe(weapons?.id)
  })
})

describe("reviewMessage", () => {
  it("names a marked snapshot by id, so it is asked about once", () => {
    const snapshot: Snapshot = {
      id: 7,
      takenAt: NOW - 60_000,
      importedAt: NOW,
      source: "Moongazer",
      uid: null,
      summary: {
        characters: 1,
        weapons: 1,
        artifacts: 1,
        materials: 1,
        mora: null,
        primogems: null,
        artifacts4: null,
        artifacts3: null,
        essence: null,
      },
      hasRaw: true,
      review: true,
      session: null,
      live: false,
    }
    expect(reviewMessage(snapshot)).toMatchObject({ id: "sync-review:7", page: "overview" })
  })
})
