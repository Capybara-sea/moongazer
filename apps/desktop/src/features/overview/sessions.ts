// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Snapshot } from "@/lib/backend"

/** One auto sync login in the history: its snapshots and its head row as one row. */
export type SessionItem = {
  kind: "session"
  session: number
  /** Its newest row (the head row while playing) and its oldest (the login's snapshot). */
  newest: Snapshot
  oldest: Snapshot
  /** Its head row is live: the game is read right now. */
  live: boolean
  /** One of its snapshots is marked for review. */
  review: boolean
}

/** A snapshot with no session (an import, or one saved before sessions were kept), by its place. */
export type SnapshotItem = { kind: "snapshot"; snapshot: Snapshot; index: number }

/**
 * The history (newest first) with each session's rows taken together, where
 * its newest row is; other snapshots stay rows of their own.
 */
export function historyItems(snapshots: readonly Snapshot[]): (SessionItem | SnapshotItem)[] {
  const items: (SessionItem | SnapshotItem)[] = []
  const sessions = new Map<number, SessionItem>()
  for (const [index, snapshot] of snapshots.entries()) {
    const { session } = snapshot
    if (session === null) {
      items.push({ kind: "snapshot", snapshot, index })
      continue
    }
    const known = sessions.get(session)
    if (known) {
      known.oldest = snapshot
      known.live ||= snapshot.live
      known.review ||= snapshot.review
      continue
    }
    const item: SessionItem = {
      kind: "session",
      session,
      newest: snapshot,
      oldest: snapshot,
      live: snapshot.live,
      review: snapshot.review,
    }
    sessions.set(session, item)
    items.push(item)
  }
  return items
}
