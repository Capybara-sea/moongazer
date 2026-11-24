// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect, useMemo } from "react"
import type { Account } from "@/domain/account"
import {
  EMPTY_TASKS,
  type TaskRow,
  type TasksDoc,
  taskRows,
  toggleCheck,
  toggleJudging,
} from "@/domain/tasks"
import { useTasksStore } from "@/stores/tasksStore"
import { text } from "@/text/zh"

const t = text.tasks

/** Every task of a snapshot with its tick, and the means to change the ticks. */
export type TaskBoard = {
  rows: TaskRow[]
  doc: TasksDoc
  /** Whether ticks and the player's own tasks can be saved. */
  editable: boolean
  /** Why they cannot, when that is not plain from the page. */
  problem?: string
  toggle: (row: TaskRow) => void
  toggleJudging: (row: TaskRow) => void
}

/**
 * The account's saved custom tasks and ticks, read by UID. Without a UID, or
 * when they cannot be read, the snapshot's own judgement still shows but
 * nothing can be changed, and `problem` says why.
 */
function useTasks(uid: number | null) {
  const storeUid = useTasksStore(s => s.uid)
  const status = useTasksStore(s => s.status)
  const doc = useTasksStore(s => s.doc)
  const error = useTasksStore(s => s.error)
  const saveError = useTasksStore(s => s.saveError)
  useEffect(() => {
    if (uid !== null) void useTasksStore.getState().load(uid)
  }, [uid])
  const mine = uid !== null && storeUid === uid
  const problem =
    uid === null
      ? t.noUid
      : mine && status === "failed"
        ? t.loadFailed(error ?? "")
        : mine && saveError
          ? t.saveFailed(saveError)
          : undefined
  return { doc: mine ? doc : EMPTY_TASKS, editable: mine && status === "ready", problem }
}

/** The tasks of a snapshot's account, judged at `now`, with its ticks. */
export function useTaskBoard(account: Account, uid: number | null, now: number): TaskBoard {
  const { doc, editable, problem } = useTasks(uid)
  const rows = useMemo(() => taskRows(account, doc, now), [account, doc, now])
  return {
    rows,
    doc,
    editable,
    problem,
    // The ticks are pruned against every row, those hidden too.
    toggle: row => useTasksStore.getState().change(d => toggleCheck(d, rows, row, now)),
    toggleJudging: row => {
      if (row.kind !== "custom") useTasksStore.getState().change(d => toggleJudging(d, row))
    },
  }
}
