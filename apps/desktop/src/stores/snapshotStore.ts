// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import { NAME_KINDS, type NameKind, unnamed } from "@/domain/names"
import {
  BackendError,
  deleteSnapshot,
  type ImportWarning,
  importSnapshot,
  isHead,
  keepSnapshot,
  listSnapshots,
  type Snapshot,
  toBackendError,
} from "@/lib/backend"

type FileOutcome =
  | { file: string; status: "saved" | "skipped" }
  | { file: string; status: "duplicate"; takenAt: number }
  | { file: string; status: "failed"; error: BackendError }

/** `id` tells apart files of the same name. */
export type FileResult = FileOutcome & { id: number }

/**
 * A file that looks wrong next to its account's snapshot before it, or is of
 * a new account, waiting for the user.
 */
export type PendingConfirmation = { file: string; warnings: ImportWarning[] }

type SnapshotState = {
  /** Newest first; null until loaded. */
  snapshots: Snapshot[] | null
  loadError: string | null
  /** Files done and total while an import runs. */
  progress: { done: number; total: number } | null
  /** The last import's files, until dismissed. */
  results: FileResult[] | null
  /** Keys of the saved files that the bundled names do not cover. */
  unnamed: Record<NameKind, string[]> | null
  confirmation: PendingConfirmation | null
  load: () => Promise<void>
  /** Puts a session's new head row in place of its old one, without reading the list again. */
  setHead: (head: Snapshot) => void
  importFiles: (files: File[]) => Promise<void>
  /** Answers the pending confirmation. */
  confirm: (save: boolean) => void
  dismissResults: () => void
  /**
   * Keeps or deletes a snapshot auto sync marked for review. A failed answer
   * is thrown; failing to read the history again after it lands in loadError.
   */
  keep: (id: number) => Promise<void>
  remove: (id: number) => Promise<void>
}

let answer: ((save: boolean) => void) | null = null

/** Reads of the list started so far: only the last one's answer is kept. */
let reads = 0

/** How many head rows setHead put in so far, and each session's last one with its count then. */
let headsPut = 0
const lastHeads = new Map<number | null, { head: Snapshot; count: number }>()

/**
 * The list (newest first, by time and then id, as storage lists it) with
 * `head` in place of its session's head row before.
 */
export function withHead(snapshots: readonly Snapshot[], head: Snapshot): Snapshot[] {
  const rest = snapshots.filter(s => !(isHead(s) && s.session === head.session))
  const at = rest.findIndex(
    s => s.takenAt < head.takenAt || (s.takenAt === head.takenAt && s.id < head.id),
  )
  return at === -1 ? [...rest, head] : [...rest.slice(0, at), head, ...rest.slice(at)]
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  snapshots: null,
  loadError: null,
  progress: null,
  results: null,
  unnamed: null,
  confirmation: null,

  async load() {
    const read = ++reads
    const started = headsPut
    try {
      let snapshots = await listSnapshots()
      // A later read is on its way, and lists at least as much.
      if (read !== reads) return
      // A head row put in while the list was read, unless the list has its
      // session as new: a later head row, or a snapshot holding it.
      for (const { head, count } of lastHeads.values()) {
        const covered = snapshots.some(
          s =>
            s.session === head.session && (isHead(s) ? s.id <= head.id : s.takenAt >= head.takenAt),
        )
        if (count > started && !covered) snapshots = withHead(snapshots, head)
      }
      set({ snapshots, loadError: null })
    } catch (error) {
      if (read === reads) set({ loadError: toBackendError(error).message })
    }
  },

  setHead(head) {
    headsPut++
    lastHeads.set(head.session, { head, count: headsPut })
    const { snapshots } = get()
    // Before the first read the list comes with the head anyway.
    if (snapshots) set({ snapshots: withHead(snapshots, head) })
  },

  /** One file at a time, oldest first, so each is checked against the one before. */
  async importFiles(files) {
    if (get().progress || files.length === 0) return
    const queue = [...files].sort((a, b) => a.lastModified - b.lastModified)
    const results: FileResult[] = []
    const missing = new Map(NAME_KINDS.map(kind => [kind, new Set<string>()]))
    set({ progress: { done: 0, total: queue.length }, results: null, unnamed: null })
    for (const file of queue) {
      results.push({ ...(await importFile(file, missing)), id: results.length })
      set({ progress: { done: results.length, total: queue.length } })
    }
    const sorted = (kind: NameKind) => [...(missing.get(kind) ?? [])].sort()
    const unnamedKeys = {
      characters: sorted("characters"),
      weapons: sorted("weapons"),
      artifactSets: sorted("artifactSets"),
      materials: sorted("materials"),
    }
    const anyUnnamed = NAME_KINDS.some(kind => unnamedKeys[kind].length > 0)
    set({ progress: null, results, unnamed: anyUnnamed ? unnamedKeys : null })
    await get().load()
  },

  confirm(save) {
    set({ confirmation: null })
    answer?.(save)
    answer = null
  },

  dismissResults() {
    set({ results: null, unnamed: null })
  },

  async keep(id) {
    await keepSnapshot(id)
    await get().load()
  },

  async remove(id) {
    await deleteSnapshot(id)
    await get().load()
  },
}))

async function importFile(file: File, missing: Map<NameKind, Set<string>>): Promise<FileOutcome> {
  let text: string
  try {
    text = await file.text()
  } catch (error) {
    const reason = new BackendError("read", toBackendError(error).message)
    return { file: file.name, status: "failed", error: reason }
  }
  try {
    let result = await importSnapshot(text, file.lastModified, false)
    if (result.outcome.status === "needsConfirmation") {
      const { warnings } = result.outcome
      const save = await new Promise<boolean>(resolve => {
        answer = resolve
        useSnapshotStore.setState({ confirmation: { file: file.name, warnings } })
      })
      if (!save) return { file: file.name, status: "skipped" }
      result = await importSnapshot(text, file.lastModified, true)
    }
    const { outcome, keys } = result
    switch (outcome.status) {
      case "saved":
        for (const kind of NAME_KINDS) {
          for (const key of unnamed(kind, keys[kind])) missing.get(kind)?.add(key)
        }
        return { file: file.name, status: "saved" }
      case "duplicate":
        return { file: file.name, status: "duplicate", takenAt: outcome.takenAt }
      case "needsConfirmation":
        // A confirmed import is never asked again; skipped just in case.
        return { file: file.name, status: "skipped" }
    }
  } catch (error) {
    return { file: file.name, status: "failed", error: toBackendError(error) }
  }
}
