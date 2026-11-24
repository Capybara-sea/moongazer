// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect, useState } from "react"
import { create } from "zustand"
import { type Account, parseAccount } from "@/domain/account"
import { type AccountGroup, groupAccounts, latestKept, newestAccount } from "@/domain/accounts"
import { setTraveler } from "@/domain/names"
import { getSnapshotExport, type Snapshot, toBackendError } from "@/lib/backend"
import { readStored, writeStored } from "@/lib/storage"
import { text } from "@/text/zh"
import { useSnapshotStore } from "./snapshotStore"

export type AccountEntry =
  | { status: "loading" }
  | { status: "ready"; account: Account }
  /** Only the summary of this snapshot is kept. */
  | { status: "summaryOnly" }
  | { status: "failed"; message: string }

type Entries = Record<number, AccountEntry>
/** Nicknames by account token. */
type Names = Record<number, string>
/** Profile picture and frame ids. */
export type Face = { picture: number | undefined; frame: number | undefined }
type Faces = Record<number, Face>

type AccountState = {
  /**
   * The token of the account chosen by hand, kept until the next login;
   * null follows the account of the newest snapshot.
   */
  account: number | null
  /** Every account, in the order they were first saved. */
  accounts: AccountGroup[]
  /** The account the pages are on: the chosen one, else the followed one. Null without snapshots. */
  group: AccountGroup | null
  /** Each account's nickname, from its newest export read so far. */
  names: Names
  /** Each account's profile picture and frame, likewise. */
  faces: Faces
  /** The snapshot the account pages show within the account; null follows its newest. */
  selectedId: number | null
  /** Parsed exports by snapshot id. */
  entries: Entries
  /**
   * The snapshot the account pages show: the current one (the chosen one, or
   * the account's newest whose export is kept) once its export is read, until
   * then the one shown before, of the account before after a switch. Null
   * without snapshots.
   */
  shown: Snapshot | null
  /** The token of the account `shown` is of. */
  shownAccount: number | null
  /** `selectedId` as it was when `shown` last moved, which says whether `shown` is the newest. */
  shownSelected: number | null
  select: (id: number | null) => void
  /** Chooses an account by its token; null follows the newest snapshot's. */
  selectAccount: (token: number | null) => void
  /** A login settled: the pages go to its account, or follow until its first snapshot is listed. */
  selectLogin: (uid: number | null) => void
  load: (id: number) => Promise<void>
  /**
   * Reads what was left while the window was hidden: the current snapshot's
   * export and the head rows asked for meanwhile that are still listed.
   */
  loadSkipped: () => void
}

/** Holds a token only, never a UID or a nickname. */
const ACCOUNT_KEY = "moongazer:accounts:selected"

/** Head rows asked for while the window was hidden. */
const skipped = new Set<number>()
/** The list the accounts were last grouped from. */
let grouped: readonly Snapshot[] | null = null
const NONE: Snapshot[] = []

function storedAccount() {
  const token = Number(readStored(ACCOUNT_KEY))
  return Number.isSafeInteger(token) && token > 0 ? token : null
}

export const useAccountStore = create<AccountState>((set, get) => ({
  account: storedAccount(),
  accounts: [],
  group: null,
  names: {},
  faces: {},
  selectedId: null,
  entries: {},
  shown: null,
  shownAccount: null,
  shownSelected: null,

  select(id) {
    set({ selectedId: id })
    follow()
  },

  selectAccount(token) {
    set({ account: token })
    writeStored(ACCOUNT_KEY, token === null ? "" : String(token))
    follow()
  },

  selectLogin(uid) {
    const group = uid === null ? undefined : get().accounts.find(g => g.uid === uid)
    get().selectAccount(group?.token ?? null)
  },

  async load(id) {
    if (get().entries[id]) return
    // A head row comes every 15 s while playing; a hidden window reads the
    // ones asked for when it shows again.
    if (isHeadId(id) && document.hidden) {
      skipped.add(id)
      return
    }
    // Not put back once dropped meanwhile: the row is no longer listed.
    const put = (entry: AccountEntry) =>
      set(s => (s.entries[id] ? { entries: { ...s.entries, [id]: entry } } : s))
    set(s => ({ entries: { ...s.entries, [id]: { status: "loading" } } }))
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
    follow()
  },

  loadSkipped() {
    const listed = new Set(useSnapshotStore.getState().snapshots?.map(s => s.id))
    const ids = [...skipped].filter(id => listed.has(id))
    skipped.clear()
    follow()
    for (const id of ids) void get().load(id)
  },
}))

const isHeadId = (id: number) => id < 0
/** Whether the pages can show `snapshot`: its export is read, or not kept. */
function isSettled(snapshot: Snapshot, entries: Entries) {
  const entry = entries[snapshot.id]
  return !snapshot.hasRaw || (entry !== undefined && entry.status !== "loading")
}

/**
 * Every snapshot older than `snapshot`, newest first. One no longer listed (a
 * head row a newer batch replaced) is placed where it was.
 */
export function olderThan(snapshots: readonly Snapshot[], snapshot: Snapshot) {
  const index = snapshots.findIndex(s => s.id === snapshot.id)
  if (index >= 0) return snapshots.slice(index + 1)
  return snapshots.filter(
    s => s.takenAt < snapshot.takenAt || (s.takenAt === snapshot.takenAt && s.id < snapshot.id),
  )
}

function currentOf(snapshots: readonly Snapshot[], selectedId: number | null) {
  const selected = snapshots.find(s => s.id === selectedId)
  return selected ?? snapshots.find(s => s.hasRaw) ?? snapshots[0]
}

/**
 * What the pages show next: the current snapshot once it can be shown; until
 * then the one shown before while that still can, so the pages do not empty
 * while a new head row (one every 15 s while playing) or another account's
 * snapshot is read.
 */
export function nextShown(
  current: Snapshot | undefined,
  shown: Snapshot | null,
  entries: Entries,
): Snapshot | null {
  if (!current) return null
  if (!shown || isSettled(current, entries)) return current
  return isSettled(shown, entries) ? shown : current
}

/**
 * The entries of listed snapshots only: not of head rows newer batches
 * replaced, nor of deleted snapshots. `snapshots` lists every account's, so
 * the other accounts keep theirs.
 */
export function withoutUnlisted(entries: Entries, snapshots: readonly Snapshot[]): Entries {
  const listed = new Set(snapshots.map(s => s.id))
  const kept = Object.entries(entries).filter(([id]) => listed.has(Number(id)))
  return kept.length === Object.keys(entries).length ? entries : Object.fromEntries(kept)
}

const nicknameIn = (entry: AccountEntry | undefined) =>
  (entry?.status === "ready" && entry.account.player?.nickname) || undefined

function faceIn(entry: AccountEntry | undefined): Face | undefined {
  const player = entry?.status === "ready" ? entry.account.player : undefined
  if (player?.profilePicture === undefined && player?.profileFrame === undefined) return undefined
  return { picture: player.profilePicture, frame: player.profileFrame }
}

/**
 * What `pick` finds in each account's newest export read so far. The one
 * known before stays while a newer row is read, not an older row's, so it
 * does not flash back with each head row; `before` itself comes back when
 * nothing changed.
 */
function knownBy<T>(
  accounts: readonly AccountGroup[],
  entries: Entries,
  before: Record<number, T>,
  pick: (entry: AccountEntry | undefined) => T | undefined,
  same: (a: T, b: T) => boolean,
): Record<number, T> {
  const known: Record<number, T> = {}
  for (const { token, snapshots } of accounts) {
    let value: T | undefined
    for (const s of snapshots) {
      if (before[token] !== undefined && !isSettled(s, entries)) break
      value = pick(entries[s.id])
      if (value !== undefined) break
    }
    value ??= before[token]
    if (value !== undefined) known[token] = value
  }
  const unchanged =
    Object.keys(known).length === Object.keys(before).length &&
    Object.entries(known).every(([token, value]) => {
      const was = before[Number(token)]
      return was !== undefined && same(was, value)
    })
  return unchanged ? before : known
}

/** Each account's nickname, until one is read numbered by accountName. */
export function knownNames(accounts: readonly AccountGroup[], entries: Entries, before: Names) {
  return knownBy(accounts, entries, before, nicknameIn, Object.is)
}

/** Each account's profile picture and frame; none until an export with one is read. */
export function knownFaces(accounts: readonly AccountGroup[], entries: Entries, before: Faces) {
  return knownBy(
    accounts,
    entries,
    before,
    faceIn,
    (a, b) => a.picture === b.picture && a.frame === b.frame,
  )
}

/** An account's nickname or, until one is read, a stand-in numbered by its place in the order. */
export function accountName(accounts: readonly AccountGroup[], names: Names, token: number) {
  const index = accounts.findIndex(g => g.token === token)
  if (index < 0) return undefined
  return names[token] ?? text.accounts.unnamed(index + 1)
}

/**
 * Moves `shown` on to the current snapshot once it can be shown, dropping the
 * exports of rows no longer listed then, and reads what the current one and
 * each account's name and reminders need. A switch to another account starts
 * at its newest snapshot.
 */
function follow() {
  const snapshots = useSnapshotStore.getState().snapshots ?? NONE
  const state = useAccountStore.getState()
  const accounts = snapshots === grouped ? state.accounts : groupAccounts(snapshots, state.accounts)
  grouped = snapshots
  const group =
    accounts.find(g => g.token === state.account) ?? newestAccount(accounts, snapshots) ?? null
  // A choice no longer listed is let go, so a later snapshot given its id is not taken for it.
  const selectedId =
    group?.token === state.group?.token && group?.snapshots.some(s => s.id === state.selectedId)
      ? state.selectedId
      : null
  const current = currentOf(group?.snapshots ?? [], selectedId)
  const shown = nextShown(current, state.shown, state.entries)
  const moved = shown === current
  const next = {
    accounts,
    group,
    names: knownNames(accounts, state.entries, state.names),
    faces: knownFaces(accounts, state.entries, state.faces),
    selectedId,
    shown,
    shownAccount: moved ? (group?.token ?? null) : state.shownAccount,
    shownSelected: moved ? selectedId : state.shownSelected,
    entries: moved ? withoutUnlisted(state.entries, snapshots) : state.entries,
  }
  if ((Object.keys(next) as (keyof typeof next)[]).some(key => next[key] !== state[key])) {
    useAccountStore.setState(next)
  }
  for (const needed of [current, ...accounts.map(latestKept)]) {
    if (needed?.hasRaw) void state.load(needed.id)
  }
}

useSnapshotStore.subscribe((state, previous) => {
  if (state.snapshots !== previous.snapshots) follow()
})

/**
 * The snapshot the account pages show, its account's snapshots, the ones
 * before it and its parsed export. Without a choice that is the account's
 * newest snapshot whose export is kept (the live head row while playing);
 * while the next one is read, the one shown before, which after a switch is
 * of the account before.
 */
export function useCurrentSnapshot() {
  const snapshot = useAccountStore(s => s.shown) ?? undefined
  const list =
    useAccountStore(s => s.accounts.find(g => g.token === s.shownAccount)?.snapshots) ?? NONE
  const entry = useAccountStore(s => (snapshot ? s.entries[snapshot.id] : undefined))
  const selected = useAccountStore(s => s.shownSelected)
  return {
    snapshot,
    /** The choice it was shown by: null when following the newest. */
    selected,
    /** Every snapshot of its account, newest first. */
    list,
    /** Every snapshot of its account older than it, newest first. */
    older: snapshot ? olderThan(list, snapshot) : NONE,
    entry,
  }
}

/** The current snapshot as useCurrentSnapshot gives it, with its account once read. */
export function useCurrentAccount() {
  const current = useCurrentSnapshot()
  const { snapshot, entry } = current
  return {
    ...current,
    account: snapshot?.hasRaw && entry?.status === "ready" ? entry.account : undefined,
  }
}

/** The account in an entry: undefined while it is read, null when there is none to read. */
export function entryAccount(exists: boolean, entry: AccountEntry | undefined) {
  if (!exists) return null
  if (entry === undefined || entry.status === "loading") return undefined
  return entry.status === "ready" ? entry.account : null
}

/**
 * The account to compare the shown one with: the same account's newest older
 * snapshot whose export is kept, read the first time it is needed. Undefined
 * while it is read, null when there is none or it cannot be read. Pages
 * decide themselves when an older account has too little to compare with.
 */
export function usePreviousAccount(): Account | null | undefined {
  const { older } = useCurrentSnapshot()
  const previous = older.find(s => s.hasRaw)
  const entry = useAccountStore(s => (previous ? s.entries[previous.id] : undefined))
  useEffect(() => {
    if (previous) void useAccountStore.getState().load(previous.id)
  }, [previous])
  return entryAccount(previous !== undefined, entry)
}

type Newest = { token: number; snapshot: Snapshot; account: Account }

/**
 * An account's newest snapshot whose export is kept, whatever the pages show,
 * with its account once read. While a newer one is read (a head row every
 * 15 s while playing), the one read before stays, as the pages keep theirs.
 */
export function useNewestAccount(group: AccountGroup) {
  const newest = latestKept(group)
  const entry = useAccountStore(s => (newest ? s.entries[newest.id] : undefined))
  const read: Newest | undefined =
    newest && entry?.status === "ready"
      ? { token: group.token, snapshot: newest, account: entry.account }
      : undefined
  const [kept, setKept] = useState(read)
  const reading = newest !== undefined && (entry === undefined || entry.status === "loading")
  if (
    read &&
    (kept?.snapshot !== read.snapshot || kept.account !== read.account || kept.token !== read.token)
  ) {
    setKept(read)
  }
  // One that could not be read, or has only its summary, is what there is: nothing older comes back.
  if (!read && !reading && kept) setKept(undefined)
  const shown = read ?? (reading && kept?.token === group.token ? kept : undefined)
  // Each account's newest is read anyway, for its name.
  return { snapshot: shown?.snapshot, account: shown?.account }
}

/** An account's name where two or more are saved, else null: one needs no name. */
export function useAccountName(token: number | undefined) {
  return useAccountStore(s =>
    token !== undefined && s.accounts.length > 1
      ? (accountName(s.accounts, s.names, token) ?? null)
      : null,
  )
}

// Every Traveler's icon follows the shown account's twin. This runs on each change of the store
// before the pages, which subscribe later, draw again.
useAccountStore.subscribe(state => {
  const entry = state.shown ? state.entries[state.shown.id] : undefined
  setTraveler(entry?.status === "ready" ? entry.account.traveler : undefined)
})
