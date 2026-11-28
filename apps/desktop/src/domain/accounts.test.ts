// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Snapshot } from "@/lib/backend"
import type { CaptureStatus } from "@/lib/backend/sync"
import { formatDateTime } from "@/lib/format"
import { text } from "@/text"
import { groupAccounts, isNewest, latestKept, liveUid, newestAccount, timeLabel } from "./accounts"

/** Made-up UIDs. */
const A = 100000001
const B = 200000002

const row = (id: number, takenAt: number, uid: number | null, session: number | null = null) =>
  ({
    id,
    takenAt,
    importedAt: takenAt,
    source: "Fake",
    uid,
    summary: {
      characters: 0,
      weapons: 0,
      artifacts: 0,
      materials: 0,
      mora: null,
      primogems: null,
      artifacts4: null,
      artifacts3: null,
      essence: null,
    },
    hasRaw: true,
    review: false,
    session,
    live: false,
  }) satisfies Snapshot

const ids = (snapshots: readonly Snapshot[]) => snapshots.map(s => s.id)

describe("groupAccounts", () => {
  it("groups by UID, newest first, in the order the accounts were first saved", () => {
    const list = [row(4, 4, B), row(3, 3, A), row(2, 2, B), row(1, 1, A)]
    const accounts = groupAccounts(list, [])
    expect(accounts.map(g => [g.uid, g.token, ids(g.snapshots)])).toEqual([
      [A, 1, [3, 1]],
      [B, 2, [4, 2]],
    ])
  })

  it("puts a snapshot without a UID with the newest older one that has one", () => {
    const accounts = groupAccounts([row(5, 5, null), row(4, 4, B), row(3, 3, A)], [])
    expect(accounts.map(g => ids(g.snapshots))).toEqual([[3], [5, 4]])
  })

  it("puts one older than every UID with the oldest, without taking the token from it", () => {
    const accounts = groupAccounts([row(3, 3, B), row(2, 2, A), row(1, 1, null)], [])
    expect(accounts.map(g => [g.uid, g.token, ids(g.snapshots)])).toEqual([
      [A, 2, [2, 1]],
      [B, 3, [3]],
    ])
  })

  it("has one group without a UID when no snapshot names one", () => {
    const accounts = groupAccounts([row(2, 2, null), row(1, 1, null)], [])
    expect(accounts.map(g => [g.uid, g.token, ids(g.snapshots)])).toEqual([[null, 1, [2, 1]]])
    expect(groupAccounts([], [])).toEqual([])
  })

  it("keeps a session together, its head row too, by its first snapshot with a UID", () => {
    const list = [row(-9, 6, B, 3), row(5, 5, null, 3), row(4, 4, A), row(3, 3, B, 3)]
    const accounts = groupAccounts(list, [])
    expect(accounts.map(g => [g.uid, ids(g.snapshots)])).toEqual([
      [B, [-9, 5, 3]],
      [A, [4]],
    ])
  })

  it("gives back the group before when it did not change", () => {
    const list = [row(2, 2, B), row(1, 1, A)]
    const before = groupAccounts(list, [])
    const after = groupAccounts([row(-7, 3, B, 2), ...list], before)
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
  })
})

describe("newestAccount and latestKept", () => {
  it("finds the account of the newest snapshot and its newest export kept", () => {
    const summaryOnly = { ...row(4, 4, B), hasRaw: false }
    const list = [summaryOnly, row(3, 3, A), row(2, 2, B)]
    const accounts = groupAccounts(list, [])
    const newest = newestAccount(accounts, list)
    expect(newest?.uid).toBe(B)
    expect(newest && latestKept(newest)?.id).toBe(2)
  })
})

describe("isNewest", () => {
  const kept = row(3, 3, B)
  const older = row(2, 2, B)
  const list = [{ ...row(4, 4, B), hasRaw: false }, kept, older]

  it("is newest while following, whatever is shown till the newest is read", () => {
    expect(isNewest(older, list, null)).toBe(true)
  })

  it("is not newest on a pick deleted since", () => {
    const deleted = row(1, 1, B)
    expect(isNewest(deleted, list, deleted.id)).toBe(false)
  })

  it("takes a pick as newest with no kept snapshot after it, past one with only its summary", () => {
    expect(isNewest(kept, list, kept.id)).toBe(true)
    expect(isNewest(older, list, older.id)).toBe(false)
    // Picked from the newest, which stays shown till the pick is read.
    expect(isNewest(kept, list, older.id)).toBe(true)
  })

  it("counts a newer kept snapshot still being read against a pick", () => {
    const head = row(-7, 6, B, 1)
    expect(isNewest(kept, [head, ...list], kept.id)).toBe(false)
    // A head row the newer one replaced, placed by its time.
    expect(isNewest(row(-6, 5, B, 1), [head, ...list], kept.id)).toBe(false)
  })
})

describe("timeLabel", () => {
  it("writes the time, a live head row as live and another as the last sync", () => {
    const at = new Date(2026, 10, 19, 21, 30).getTime()
    expect(timeLabel(row(1, at, A))).toBe(formatDateTime(at))
    expect(timeLabel({ ...row(-2, at, A, 1), live: true })).toBe(text.snapshot.live)
    expect(timeLabel(row(-2, at, A, 1))).toBe(text.snapshot.lastSync(formatDateTime(at)))
  })

  it("writes live for the account's newest snapshot while auto sync reads it", () => {
    const at = new Date(2026, 10, 19, 21, 30).getTime()
    expect(timeLabel(row(1, at, A), true)).toBe(text.snapshot.live)
  })
})

describe("liveUid", () => {
  const connected: CaptureStatus = {
    phase: "connected",
    helper: "running",
    server: "china",
    entered: true,
    account: { nickname: "Fake", uid: B, adventureRank: 1 },
    loginAt: 1,
    lostAt: null,
    settled: true,
    savedAt: 1,
    compatible: false,
    problem: null,
  }

  it("is the settled login's UID while connected, also before any batch", () => {
    expect(liveUid(connected)).toBe(B)
  })

  it("is none before the login settled, once reading stopped or without a status", () => {
    expect(liveUid({ ...connected, settled: false })).toBeNull()
    expect(liveUid({ ...connected, phase: "interrupted", lostAt: 2 })).toBeNull()
    expect(liveUid(null)).toBeNull()
  })
})
