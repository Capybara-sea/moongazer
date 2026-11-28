// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { isHead, type Snapshot } from "@/lib/backend"
import { text } from "@/text"

/**
 * The changes a delete takes with the snapshot, as storage deletes them: a
 * login snapshot takes its session's, the session's newest snapshot the ones
 * after the snapshot before it. Null when it takes none.
 */
export function deleteTakes(snapshot: Snapshot, snapshots: readonly Snapshot[]): string | null {
  if (snapshot.session === null) return null
  if (snapshot.session === snapshot.id) return text.review.takesSession
  const newer = snapshots.some(
    s =>
      !isHead(s) &&
      s.id !== snapshot.id &&
      s.session === snapshot.session &&
      s.takenAt >= snapshot.takenAt,
  )
  return newer ? null : text.review.takesLatest
}

/**
 * The snapshot auto sync checked one against when it saved it, from the ones
 * older (newest first): the newest of its account (of any, for one without a
 * UID), head rows passed by, as storage picks it.
 */
export function checkedAgainst(snapshot: Snapshot, older: readonly Snapshot[]) {
  return older.find(s => !isHead(s) && (snapshot.uid === null || s.uid === snapshot.uid))
}

/**
 * Why auto sync marked a snapshot, by the rules it marks with: fewer
 * characters, a fifth fewer weapons or artifacts than its account's snapshot
 * before. That one may be gone or another by now (deleted, or an older file
 * imported since), and a mark from before snapshots were compared within an
 * account may have had another reason, so when no rule explains it, it says
 * the snapshot can be kept.
 */
export function reviewReasons(snapshot: Snapshot, previous: Snapshot | undefined): string[] {
  const reasons: string[] = []
  if (previous) {
    const now = snapshot.summary
    const before = previous.summary
    const fewer = text.confirm.fewer
    if (now.characters < before.characters) {
      reasons.push(fewer.characters(before.characters, now.characters))
    }
    for (const what of ["weapons", "artifacts"] as const) {
      if (now[what] * 5 < before[what] * 4) reasons.push(fewer[what](before[what], now[what]))
    }
  }
  return reasons.length > 0 ? reasons : [text.review.noReason]
}
