// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import type { WishRecord } from "@/domain/wishes"
import { toBackendError } from "@/lib/backend"
import { getSyncSettings, setWishAutoRead } from "@/lib/backend/sync"
import {
  getWishes,
  type WishImport,
  type WishProgress,
  type WishReadEnd,
} from "@/lib/backend/wishes"
import { readStored, writeStored } from "@/lib/storage"

const HIDE_EMPTY_KEY = "moongazer:wishes:hideEmpty"
const HIDE_NOVICE_KEY = "moongazer:wishes:hideNovice"

/** What the page says after an import or an export, until it is closed. A read ends in a toast. */
export type WishNotice =
  | { kind: "import"; results: WishImport[]; uid: number }
  | { kind: "export"; count: number; path: string }
  | { kind: "error"; message: string }

/**
 * The wish history of the account the page shows, read from the database;
 * auto sync's reading of the game's history as it goes; and the page's
 * settings (both pools that can be hidden are, by default).
 */
type WishState = {
  uid: number | null
  records: WishRecord[]
  readAt: number | null
  status: "idle" | "loading" | "ready" | "failed"
  error: string | null
  /** A read under way, of any account. */
  progress: WishProgress | null
  notice: WishNotice | null
  /** Null until read. */
  autoRead: boolean | null
  autoReadError: string | null
  hideEmpty: boolean
  hideNovice: boolean
  /** The pool display popover is open. */
  displayOpen: boolean
  load: (uid: number, again?: boolean) => Promise<void>
  loadAutoRead: () => Promise<void>
  setAutoRead: (on: boolean) => Promise<void>
  setHideEmpty: (on: boolean) => void
  setHideNovice: (on: boolean) => void
  setNotice: (notice: WishNotice | null) => void
  setDisplayOpen: (open: boolean) => void
  onProgress: (progress: WishProgress) => void
  onRead: (end: WishReadEnd) => void
}

export const useWishStore = create<WishState>((set, get) => ({
  uid: null,
  records: [],
  readAt: null,
  status: "idle",
  error: null,
  progress: null,
  notice: null,
  autoRead: null,
  autoReadError: null,
  hideEmpty: readStored(HIDE_EMPTY_KEY) !== "false",
  hideNovice: readStored(HIDE_NOVICE_KEY) !== "false",
  displayOpen: false,
  async load(uid, again = false) {
    if (!again && get().uid === uid && get().status !== "failed") return
    if (get().uid !== uid) {
      set({ uid, records: [], readAt: null, status: "loading", error: null, notice: null })
    }
    try {
      const stored = await getWishes(uid)
      if (get().uid !== uid) return
      set({ records: stored.records, readAt: stored.readAt, status: "ready", error: null })
    } catch (error) {
      if (get().uid !== uid) return
      set({ status: "failed", error: toBackendError(error).message })
    }
  },
  async loadAutoRead() {
    try {
      set({ autoRead: (await getSyncSettings()).wishAutoRead })
    } catch (error) {
      set({ autoReadError: toBackendError(error).message })
    }
  },
  async setAutoRead(on) {
    const before = get().autoRead
    set({ autoRead: on, autoReadError: null })
    try {
      await setWishAutoRead(on)
    } catch (error) {
      set({ autoRead: before, autoReadError: toBackendError(error).message })
    }
  },
  setHideEmpty(on) {
    set({ hideEmpty: on })
    writeStored(HIDE_EMPTY_KEY, String(on))
  },
  setHideNovice(on) {
    set({ hideNovice: on })
    writeStored(HIDE_NOVICE_KEY, String(on))
  },
  setNotice(notice) {
    set({ notice })
  },
  setDisplayOpen(open) {
    set({ displayOpen: open })
  },
  onProgress(progress) {
    set({ progress })
  },
  onRead(end) {
    set({ progress: null })
    const uid = get().uid
    if (uid === end.uid) void get().load(uid, true)
  },
}))
