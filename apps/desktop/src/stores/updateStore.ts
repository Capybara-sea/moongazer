// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import {
  type AppInfo,
  checkUpdate,
  downloadUpdate,
  getAppInfo,
  installUpdate,
  onUpdateProgress,
  toBackendError,
  type UpdateInfo,
  type UpdateProgress,
} from "@/lib/backend"

/**
 * available: the portable build found a new version, to download by hand.
 * ready: the installed build has downloaded it and installs it on restart.
 */
export type UpdateStatus =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "ready"
  | "restarting"
  | "disabled"
  | "error"

type UpdateState = {
  info: AppInfo | null
  loadError: string | null
  status: UpdateStatus
  update: UpdateInfo | null
  progress: UpdateProgress | null
  /** What went wrong, for the "error" status. */
  failed: "check" | "download" | "install" | null
  error: string | null
  autoCheck: boolean
  load: () => Promise<void>
  check: (manual?: boolean) => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
  setAutoCheck: (on: boolean) => void
}

const AUTO_CHECK_KEY = "moongazer:update:autoCheck"
/** The first check waits until startup has settled. */
const FIRST_CHECK_MS = 5_000
const CHECK_EVERY_MS = 60 * 60 * 1000

function readAutoCheck() {
  try {
    return localStorage.getItem(AUTO_CHECK_KEY) !== "off"
  } catch {
    // Storage unavailable: keep the default, on.
    return true
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Checks after `delay` and then every hour, while automatic checks are on. */
function scheduleChecks(delay: number) {
  clearTimeout(timer)
  const { autoCheck, info } = useUpdateStore.getState()
  if (!autoCheck || !info?.updatesEnabled) return
  timer = setTimeout(() => {
    void useUpdateStore.getState().check(false)
    scheduleChecks(CHECK_EVERY_MS)
  }, delay)
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  info: null,
  loadError: null,
  status: "idle",
  update: null,
  progress: null,
  failed: null,
  error: null,
  autoCheck: readAutoCheck(),

  async load() {
    try {
      const info = await getAppInfo()
      set({ info, status: info.updatesEnabled ? "idle" : "disabled" })
      scheduleChecks(FIRST_CHECK_MS)
    } catch (error) {
      set({ loadError: toBackendError(error).message })
    }
  },

  /** Automatic checks (manual = false) fail quietly; the next one may work. */
  async check(manual = true) {
    const before = get().status
    if (["checking", "downloading", "ready", "restarting"].includes(before)) return
    set({ status: "checking", failed: null, error: null })
    try {
      const update = await checkUpdate()
      if (!update) {
        set({ update: null, status: "upToDate" })
        return
      }
      set({ update })
      if (get().info?.portable) set({ status: "available" })
      else await get().download()
    } catch (error) {
      if (manual) set({ status: "error", failed: "check", error: toBackendError(error).message })
      else set({ status: before })
    }
  },

  async download() {
    set({ status: "downloading", progress: null, failed: null, error: null })
    const unlisten = await onUpdateProgress(progress => set({ progress }))
    try {
      await downloadUpdate()
      set({ status: "ready" })
    } catch (error) {
      set({ status: "error", failed: "download", error: toBackendError(error).message })
    } finally {
      unlisten()
    }
  },

  /** Installed build: the app closes, installs and opens again. Portable: the download page. */
  async install() {
    const portable = get().info?.portable ?? false
    if (!portable) set({ status: "restarting" })
    try {
      await installUpdate()
    } catch (error) {
      set({ status: "error", failed: "install", error: toBackendError(error).message })
    }
  },

  setAutoCheck(on) {
    try {
      localStorage.setItem(AUTO_CHECK_KEY, on ? "on" : "off")
    } catch {
      // Storage unavailable: the choice lasts until the app closes.
    }
    set({ autoCheck: on })
    if (on) scheduleChecks(CHECK_EVERY_MS)
    else clearTimeout(timer)
  },
}))
