// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import { EMPTY_TASKS, parseTasksDoc, type TasksDoc } from "@/domain/tasks"
import { getTasksData, saveTasksData, toBackendError } from "@/lib/backend"

/**
 * The overview's custom tasks and ticks of one account, kept by UID in the
 * database. Every change is saved at once; a failed load leaves editing off,
 * so tasks that could not be read are never overwritten.
 */
type TasksState = {
  uid: number | null
  doc: TasksDoc
  status: "idle" | "loading" | "ready" | "failed"
  error: string | null
  saveError: string | null
  load: (uid: number) => Promise<void>
  change: (edit: (doc: TasksDoc) => TasksDoc) => void
}

export const useTasksStore = create<TasksState>((set, get) => ({
  uid: null,
  doc: EMPTY_TASKS,
  status: "idle",
  error: null,
  saveError: null,
  async load(uid) {
    if (get().uid === uid && get().status !== "failed") return
    set({ uid, doc: EMPTY_TASKS, status: "loading", error: null, saveError: null })
    try {
      const saved = await getTasksData(uid)
      if (get().uid !== uid) return
      set({ doc: parseTasksDoc(saved), status: "ready" })
    } catch (error) {
      if (get().uid !== uid) return
      set({ status: "failed", error: toBackendError(error).message })
    }
  },
  change(edit) {
    const { uid, doc, status } = get()
    if (uid === null || status !== "ready") return
    const next = edit(doc)
    set({ doc: next })
    // One save at a time, so an older doc never lands after a newer one.
    saving = saving.then(() =>
      saveTasksData(uid, next).then(
        () => {
          if (get().uid === uid) set({ saveError: null })
        },
        error => {
          if (get().uid === uid) set({ saveError: toBackendError(error).message })
        },
      ),
    )
  },
}))

let saving: Promise<void> = Promise.resolve()
