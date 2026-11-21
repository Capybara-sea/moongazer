// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { beforeEach, describe, expect, it, vi } from "vitest"
import { getAppInfo } from "@/lib/backend"
import type { Batch, CaptureStatus } from "@/lib/backend/sync"
import {
  getCaptureChanges,
  getCaptureStatus,
  getSyncSettings,
  startCapture,
} from "@/lib/backend/sync"
import { syncOn, useCaptureStore } from "./captureStore"

vi.mock("@/lib/backend", async importOriginal => ({
  ...(await importOriginal<object>()),
  getAppInfo: vi.fn(async () => ({
    version: "0.6.0",
    portable: false,
    updatesEnabled: false,
    updatesInPlace: false,
    capture: true,
  })),
}))
vi.mock("@/lib/backend/sync", () => ({
  getCaptureStatus: vi.fn(),
  getCaptureChanges: vi.fn(async () => []),
  getSyncSettings: vi.fn(async () => ({ autoStart: true })),
  startCapture: vi.fn(async () => {}),
  stopCapture: async () => {},
  saveCaptureNow: async () => {},
  setSyncAutoStart: async () => {},
}))

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
const starting: CaptureStatus = { ...off, phase: "starting" }
const waitingGame: CaptureStatus = { ...off, phase: "waitingGame", helper: "running" }
const connected: CaptureStatus = { ...waitingGame, phase: "connected", entered: true }
const declined: CaptureStatus = { ...off, problem: { kind: "declined" } }

const batch = (at: number): Batch => ({
  at,
  changes: [{ path: ["materials", "Mora"], before: at, after: at + 1, key: null }],
})

const store = () => useCaptureStore.getState()
const busyAfter = (status: CaptureStatus) => {
  store().setStatus(status)
  return store().busy
}

beforeEach(() => {
  useCaptureStore.setState(useCaptureStore.getInitialState(), true)
  vi.mocked(getCaptureStatus).mockResolvedValue(off)
})

describe("the buttons after a start or stop", () => {
  it("wait for a start past the elevation prompt", async () => {
    store().setStatus(off)
    await store().start()
    expect(store().busy).toBe(true)
    expect(busyAfter(starting)).toBe(true)
    expect(busyAfter(waitingGame)).toBe(false)
  })

  it("wait for a restart past its stop and the prompt", async () => {
    store().setStatus({ ...connected, phase: "interrupted" })
    await store().restart()
    expect(busyAfter(off)).toBe(true)
    expect(busyAfter(starting)).toBe(true)
    expect(busyAfter(declined)).toBe(false)
  })

  it("wait for a stop until sync is off", async () => {
    store().setStatus(connected)
    await store().stop()
    expect(busyAfter({ ...connected, savedAt: 1 })).toBe(true)
    expect(busyAfter(off)).toBe(false)
  })

  it("come back when the command fails, with why", async () => {
    vi.mocked(startCapture).mockRejectedValueOnce({ kind: "ipc", message: "gone" })
    await store().start()
    expect(store()).toMatchObject({ busy: false, error: "gone" })
  })
})

describe("load", () => {
  it("keeps a status that came by event while it was reading", async () => {
    let answer: (status: CaptureStatus) => void = () => {}
    vi.mocked(getCaptureStatus).mockReturnValueOnce(new Promise(resolve => (answer = resolve)))
    const loading = store().load()
    await vi.waitFor(() => expect(store().capture).toBe(true))
    store().setStatus(connected)
    answer(off)
    await loading
    expect(store()).toMatchObject({ status: connected, autoStart: true, version: "0.6.0" })
  })

  it("keeps a failure apart from the commands' errors", async () => {
    vi.mocked(getCaptureStatus).mockRejectedValueOnce({ kind: "ipc", message: "gone" })
    await store().load()
    expect(store()).toMatchObject({ capture: true, status: null, loadError: "gone", error: null })
  })

  it("shows a failure to read the app info rather than hide auto sync", async () => {
    vi.mocked(getAppInfo).mockRejectedValueOnce({ kind: "ipc", message: "gone" })
    await store().load()
    expect(store()).toMatchObject({ capture: true, version: null, loadError: "gone" })
  })

  it("drops a failure once a status comes, unless the settings are still unread", async () => {
    vi.mocked(getCaptureStatus).mockRejectedValueOnce({ kind: "ipc", message: "gone" })
    await store().load()
    store().setStatus(waitingGame)
    expect(store()).toMatchObject({ autoStart: true, loadError: null })

    useCaptureStore.setState(useCaptureStore.getInitialState(), true)
    vi.mocked(getSyncSettings).mockRejectedValueOnce({ kind: "ipc", message: "gone" })
    await store().load()
    store().setStatus(waitingGame)
    expect(store()).toMatchObject({ autoStart: null, loadError: "gone" })
  })
})

describe("syncOn", () => {
  it("is on from the start until it is off again, whatever the stage or problem", () => {
    for (const status of [
      starting,
      waitingGame,
      connected,
      { ...connected, phase: "interrupted" as const },
    ]) {
      expect(syncOn({ status })).toBe(true)
    }
  })

  it("is off before the status is read, and when off with or without a problem", () => {
    expect(syncOn({ status: null })).toBe(false)
    expect(syncOn({ status: off })).toBe(false)
    expect(syncOn({ status: declined })).toBe(false)
  })
})

describe("the panel and the changes", () => {
  it("opens without a status too, for the accounts", () => {
    store().setPanelOpen(true)
    expect(store().panelOpen).toBe(true)
    store().setPanelOpen(false)
    expect(store().panelOpen).toBe(false)
  })

  it("keeps each batch once, in the order it was read, until they are cleared", () => {
    store().addBatch(batch(2))
    store().addBatch(batch(1))
    store().addBatch(batch(2))
    expect(store().batches).toEqual([batch(1), batch(2)])
    store().clearBatches()
    expect(store().batches).toEqual([])
  })
})

describe("loading the changes", () => {
  /** Starts a load and waits until it asks for the changes; the answer waits for `answer`. */
  const held = async () => {
    let answer: ((batches: Batch[]) => void) | undefined
    vi.mocked(getCaptureChanges).mockImplementationOnce(
      () => new Promise(resolve => (answer = resolve)),
    )
    const loading = store().load()
    await vi.waitFor(() => expect(answer).toBeDefined())
    return { loading, answer: (batches: Batch[]) => answer?.(batches) }
  }

  it("reads the batches so far", async () => {
    vi.mocked(getCaptureChanges).mockResolvedValueOnce([batch(1), batch(2)])
    await store().load()
    expect(store().batches).toEqual([batch(1), batch(2)])
  })

  it("neither loses nor repeats a batch that came by event while it was reading", async () => {
    const { loading, answer } = await held()
    store().addBatch(batch(2))
    store().addBatch(batch(3))
    answer([batch(1), batch(2)])
    await loading
    expect(store().batches).toEqual([batch(1), batch(2), batch(3)])
  })

  it("keeps only what came after a clear while it was reading", async () => {
    const { loading, answer } = await held()
    store().clearBatches()
    store().addBatch(batch(3))
    answer([batch(1), batch(2)])
    await loading
    expect(store().batches).toEqual([batch(3)])
  })
})
