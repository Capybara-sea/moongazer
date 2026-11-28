// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { isHead, type Snapshot } from "@/lib/backend"
import type { CaptureStatus } from "@/lib/backend/sync"
import { formatDateTime } from "@/lib/format"
import { text } from "@/text"

export type AccountGroup = {
  /** Null only when no snapshot names a UID. */
  uid: number | null
  /**
   * The smallest id of its snapshots with its UID: names the account where a
   * UID must not be kept, such as local storage.
   */
  token: number
  /** Newest first, head rows included. */
  snapshots: Snapshot[]
}

/**
 * The accounts in a list of snapshots (newest first), in the order they were
 * first saved. A session's snapshots count to its first one with a UID; one
 * without a UID (an export whose UID was not read) to the newest older one
 * with a UID, or with none older to the oldest one's. A group that did not
 * change is the one in `before`, so the account not being played keeps its
 * list while head rows come for the other.
 */
export function groupAccounts(
  snapshots: readonly Snapshot[],
  before: readonly AccountGroup[],
): AccountGroup[] {
  const oldestFirst = [...snapshots].reverse()
  const sessions = new Map<number, number>()
  for (const s of oldestFirst) {
    if (s.session !== null && s.uid !== null && !sessions.has(s.session)) {
      sessions.set(s.session, s.uid)
    }
  }
  const uidOf = (s: Snapshot) => (s.session === null ? undefined : sessions.get(s.session)) ?? s.uid
  let carry = oldestFirst.map(uidOf).find(uid => uid !== null) ?? null
  const groups = new Map<number | null, AccountGroup>()
  for (const s of oldestFirst) {
    const own = uidOf(s)
    if (own !== null) carry = own
    const uid = own ?? carry
    let group = groups.get(uid)
    if (!group) {
      group = { uid, token: Number.POSITIVE_INFINITY, snapshots: [] }
      groups.set(uid, group)
    }
    group.snapshots.push(s)
    if (s.id > 0 && s.uid === uid) group.token = Math.min(group.token, s.id)
  }
  return [...groups.values()]
    .map(group => {
      group.snapshots.reverse()
      const old = before.find(g => g.token === group.token && g.uid === group.uid)
      const same =
        old?.snapshots.length === group.snapshots.length &&
        old.snapshots.every((s, i) => s === group.snapshots[i])
      return same ? old : group
    })
    .sort((a, b) => a.token - b.token)
}

/** The account of the newest snapshot: the one the pages follow. */
export function newestAccount(accounts: readonly AccountGroup[], snapshots: readonly Snapshot[]) {
  return accounts.find(group => group.snapshots[0] === snapshots[0])
}

/** The account's newest snapshot whose export is kept: it names the account and gives its reminders. */
export function latestKept(group: AccountGroup) {
  return group.snapshots.find(s => s.hasRaw)
}

/**
 * Whether the pages show the account's newest snapshot, `selectedId` being
 * the choice it was shown by. Following the newest (null) they do, though till
 * a newer one is read they show the one before it (a head row every 15 s while
 * playing, a new login, an import). A choice is newest with no kept snapshot
 * after it; one deleted since is not, nor is one no longer listed placed after
 * a kept one by its time.
 */
export function isNewest(snapshot: Snapshot, list: readonly Snapshot[], selectedId: number | null) {
  if (selectedId === null) return true
  if (!list.some(s => s.id === selectedId) && snapshot.id === selectedId) return false
  const index = list.findIndex(s => s.id === snapshot.id)
  const newer = index >= 0 ? list.slice(0, index) : list.filter(s => s.takenAt > snapshot.takenAt)
  return !newer.some(s => s.hasRaw)
}

/**
 * The UID auto sync is reading live: its login settled and it is still
 * connected, with or without a live head row yet.
 */
export function liveUid(status: CaptureStatus | null) {
  return status?.phase === "connected" && status.settled ? (status.account?.uid ?? null) : null
}

/**
 * When a snapshot was read; a head row is "live" while playing, else the last
 * sync. With `live`, the account's newest snapshot while auto sync reads it,
 * before its first head row too.
 */
export function timeLabel(snapshot: Snapshot, live = false) {
  if (live) return text.snapshot.live
  const at = formatDateTime(snapshot.takenAt)
  if (!isHead(snapshot)) return at
  return snapshot.live ? text.snapshot.live : text.snapshot.lastSync(at)
}
