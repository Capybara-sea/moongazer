// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import { getAppInfo, openLogDir, toBackendError } from "@/lib/backend"
import {
  type Batch,
  type CaptureStatus,
  getCaptureChanges,
  getCaptureStatus,
  getSyncSettings,
  saveCaptureNow,
  setSyncAutoStart,
  startCapture,
  stopCapture,
} from "@/lib/backend/sync"
import { readStored, writeStored } from "@/lib/storage"

type CaptureState = {
  /** The app's version once read; "has to be updated" is said once per version. */
  version: string | null
  /** Null until read; auto sync shows from then on. */
  status: CaptureStatus | null
  /**
   * Why the status, the settings or the changes could not be read at
   * startup; a status that comes later clears it once the settings are read.
   */
  loadError: string | null
  /** Every batch of changes since the login, oldest first. */
  batches: Batch[]
  /** The side menu's account and sync panel; it opens without a status too, for the accounts. */
  panelOpen: boolean
  /** A start, stop or restart was sent and its status has not come yet. */
  busy: boolean
  /**
   * Starts sync with the app; kept by the Rust side, which reads it before
   * the page loads. Null until read.
   */
  autoStart: boolean | null
  /** Why the last start, stop, save or log folder failed. */
  error: string | null
  /** Why the auto start setting could not be saved. */
  autoStartError: string | null
  /** Whether to ask if sync should start with the app; asked once, after a start by hand. */
  askAutoStart: boolean
  load: () => Promise<void>
  setStatus: (status: CaptureStatus) => void
  addBatch: (batch: Batch) => void
  clearBatches: () => void
  start: () => Promise<void>
  stop: () => Promise<void>
  /** Stops whatever is left of a broken sync, then starts again. */
  restart: () => Promise<void>
  saveNow: () => Promise<void>
  openLog: () => Promise<void>
  /** Opens the panel only once there is a status to show. */
  setPanelOpen: (open: boolean) => void
  setAutoStart: (on: boolean) => Promise<void>
  /** The answer to that question, whichever it was; it is not asked again. */
  answerAutoStart: (on: boolean) => Promise<void>
}

/** Set once the question about auto start was answered. */
const ASKED_KEY = "moongazer:sync:askedAutoStart"

/** Whether auto sync is on: started and not stopped, whatever stage it is at. */
export const syncOn = (s: { status: CaptureStatus | null }) =>
  s.status !== null && s.status.phase !== "off"

type Outcome = (status: CaptureStatus) => boolean

/**
 * Where a start leads: past the elevation prompt, to waiting for the game or
 * back to off with the reason. A restart passes "off" with no problem first.
 */
const started: Outcome = s => s.phase !== "starting" && !(s.phase === "off" && s.problem === null)
const stopped: Outcome = s => s.phase === "off"

/** The status the last start or stop waits for; the buttons are held until it comes. */
let waitingFor: Outcome | null = null
/** How many times the batches were cleared, so a load can tell one came meanwhile. */
let clears = 0
/** A start by hand that should ask about auto start once it gets past the prompt. */
let asking = false

/** Both lists' batches once each, by when they were read. */
function joined(a: Batch[], b: Batch[]) {
  const known = new Set(a.map(batch => batch.at))
  return [...a, ...b.filter(batch => !known.has(batch.at))].sort((x, y) => x.at - y.at)
}

export const useCaptureStore = create<CaptureState>((set, get) => {
  /** Runs one command, keeping its error for the panel. */
  const run = async (command: () => Promise<void>) => {
    set({ error: null })
    try {
      await command()
    } catch (error) {
      set({ error: toBackendError(error).message })
    }
  }
  /**
   * A start or stop. The buttons wait for the status it leads to, so the
   * second click of a double click does not land on the button that follows.
   */
  const send = async (until: Outcome, command: () => Promise<void>) => {
    waitingFor = until
    set({ busy: true, error: null })
    try {
      await command()
    } catch (error) {
      waitingFor = null
      set({ busy: false, error: toBackendError(error).message })
    }
  }
  return {
    version: null,
    status: null,
    loadError: null,
    batches: [],
    panelOpen: false,
    busy: false,
    autoStart: null,
    error: null,
    autoStartError: null,
    askAutoStart: false,

    async load() {
      const failed = (error: unknown) => set({ loadError: toBackendError(error).message })
      await getAppInfo().then(info => set({ version: info.version }), failed)
      await getSyncSettings().then(settings => set({ autoStart: settings.autoStart }), failed)
      await getCaptureStatus().then(status => {
        // A status event that came meanwhile is newer.
        if (get().status === null) set({ status })
      }, failed)
      const clearsBefore = clears
      await getCaptureChanges().then(batches => {
        // A batch that came by event meanwhile may be in the answer or not.
        // After a clear meanwhile the answer may be from before it, and the
        // events since then are the whole list.
        if (clears === clearsBefore) set({ batches: joined(batches, get().batches) })
      }, failed)
    },

    setStatus(status) {
      const patch: Partial<CaptureState> = { status }
      if (waitingFor?.(status)) {
        waitingFor = null
        patch.busy = false
      }
      if (asking && started(status)) {
        asking = false
        // Only a start that worked asks; one turned down at the prompt does not.
        if (status.phase !== "off") patch.askAutoStart = true
      }
      if (get().autoStart !== null) patch.loadError = null
      set(patch)
    },

    addBatch(batch) {
      set({ batches: joined(get().batches, [batch]) })
    },

    clearBatches() {
      clears++
      set({ batches: [] })
    },

    async start() {
      asking = get().autoStart === false && readStored(ASKED_KEY) === null
      await send(started, startCapture)
      // The command failed, so no status will come for it.
      if (!get().busy) asking = false
    },
    stop: () => send(stopped, stopCapture),
    restart: () =>
      send(started, async () => {
        await stopCapture()
        await startCapture()
      }),
    saveNow: () => run(saveCaptureNow),
    openLog: () => run(openLogDir),

    setPanelOpen(open) {
      if (open !== get().panelOpen) set({ panelOpen: open })
    },

    async setAutoStart(on) {
      const before = get().autoStart
      set({ autoStart: on, autoStartError: null })
      try {
        await setSyncAutoStart(on)
      } catch (error) {
        set({ autoStart: before, autoStartError: toBackendError(error).message })
      }
    },

    async answerAutoStart(on) {
      writeStored(ASKED_KEY, "yes")
      set({ askAutoStart: false })
      if (on) await get().setAutoStart(true)
    },
  }
})
