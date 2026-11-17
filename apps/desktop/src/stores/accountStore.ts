// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect } from "react"
import { create } from "zustand"
import { type Account, parseAccount } from "@/domain/account"
import { getSnapshotExport, type Snapshot, toBackendError } from "@/lib/backend"
import { useSnapshotStore } from "./snapshotStore"

export type AccountEntry =
  | { status: "loading" }
  | { status: "ready"; account: Account }
  /** Only the summary of this snapshot is kept. */
  | { status: "summaryOnly" }
  | { status: "failed"; message: string }

type AccountState = {
  /** The snapshot the account pages show; null follows the newest one. */
  selectedId: number | null
  /** Parsed exports by snapshot id. */
  entries: Record<number, AccountEntry>
  select: (id: number | null) => void
  load: (id: number) => Promise<void>
}

export const useAccountStore = create<AccountState>((set, get) => ({
  selectedId: null,
  entries: {},

  select(id) {
    set({ selectedId: id })
  },

  async load(id) {
    if (get().entries[id]) return
    const put = (entry: AccountEntry) => set(s => ({ entries: { ...s.entries, [id]: entry } }))
    put({ status: "loading" })
    try {
      const value = await getSnapshotExport(id)
      put(
        value === null
          ? { status: "summaryOnly" }
          : { status: "ready", account: parseAccount(value) },
      )
    } catch (error) {
      put({ status: "failed", message: toBackendError(error).message })
    }
  },
}))

/**
 * The snapshot the account pages show, the ones before it and its parsed
 * export. Without a choice that is the newest snapshot whose export is kept.
 * A GOOD file is shown through the newest older Leyline snapshot, so for one
 * that snapshot is named too. It is known from the summaries alone, so both
 * exports can be read at once.
 */
export function useCurrentSnapshot() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const selectedId = useAccountStore(s => s.selectedId)
  const index = snapshots ? currentIndex(snapshots, selectedId) : -1
  const snapshot = snapshots?.[index]
  const entry = useAccountStore(s => (snapshot ? s.entries[snapshot.id] : undefined))
  const older = snapshot && snapshots ? snapshots.slice(index + 1) : []
  const fallback =
    snapshot?.format === "good" ? older.find(s => s.hasRaw && s.format === "leyline") : undefined
  const fallbackEntry = useAccountStore(s => (fallback ? s.entries[fallback.id] : undefined))
  return {
    snapshot,
    /** Every snapshot older than the current one, newest first. */
    older,
    entry,
    fallback,
    fallbackEntry,
  }
}

function currentIndex(snapshots: Snapshot[], selectedId: number | null) {
  const selected = snapshots.findIndex(s => s.id === selectedId)
  if (selected >= 0) return selected
  const kept = snapshots.findIndex(s => s.hasRaw)
  return Math.max(kept, 0)
}

/**
 * The current snapshot as useCurrentSnapshot gives it, reading its export the
 * first time a page needs it, with the account the pages show. A GOOD file
 * shows the Leyline snapshot standing in for it in full (the user's choice);
 * it counts on its own only in the snapshot history.
 */
export function useCurrentAccount() {
  const current = useCurrentSnapshot()
  const { snapshot, entry, fallback, fallbackEntry } = current
  useEffect(() => {
    for (const other of [snapshot, fallback]) {
      if (other?.hasRaw) void useAccountStore.getState().load(other.id)
    }
  }, [snapshot, fallback])
  const own = snapshot?.hasRaw && entry?.status === "ready" ? entry.account : undefined
  // Nothing shows until the stand-in is read too, so the GOOD file's own lists
  // never flash first. One that cannot be read leaves the file on its own.
  const waiting = fallback !== undefined && (!fallbackEntry || fallbackEntry.status === "loading")
  const standIn = fallbackEntry?.status === "ready" ? fallbackEntry.account : undefined
  return {
    ...current,
    account: waiting ? undefined : own && standIn ? standIn : own,
    /** The Leyline snapshot shown in place of a GOOD file. */
    standIn: !waiting && own && standIn ? fallback : undefined,
  }
}

/**
 * The snapshot whose account the shown one is compared with: what the next
 * older snapshot shows. That is the newest Leyline export older than the one
 * shown, as GOOD files in between show it in their place; with none, the
 * newest older export, which shows itself.
 */
export function previousSnapshot(older: readonly Snapshot[], standIn: Snapshot | undefined) {
  const after = standIn ? older.slice(older.indexOf(standIn) + 1) : older
  return after.find(s => s.hasRaw && s.format === "leyline") ?? after.find(s => s.hasRaw)
}

/** The account in an entry: undefined while it is read, null when there is none to read. */
export function entryAccount(exists: boolean, entry: AccountEntry | undefined) {
  if (!exists) return null
  if (entry === undefined || entry.status === "loading") return undefined
  return entry.status === "ready" ? entry.account : null
}

/**
 * The account to compare the shown one with, from previousSnapshot, read the
 * first time it is needed: undefined while it is read, null when there is
 * none or it cannot be read. Pages decide themselves when an older account
 * has too little to compare with.
 */
export function usePreviousAccount(): Account | null | undefined {
  const { older, standIn } = useCurrentAccount()
  const previous = previousSnapshot(older, standIn)
  const entry = useAccountStore(s => (previous ? s.entries[previous.id] : undefined))
  useEffect(() => {
    if (previous) void useAccountStore.getState().load(previous.id)
  }, [previous])
  return entryAccount(previous !== undefined, entry)
}
