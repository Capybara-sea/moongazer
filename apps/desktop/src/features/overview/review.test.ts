// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Snapshot } from "@/lib/backend"
import { text } from "@/text/zh"
import { checkedAgainst, deleteTakes, reviewReasons } from "./review"

const snapshot = (
  characters: number,
  weapons: number,
  artifacts: number,
  uid: number | null = 100000001,
): Snapshot => ({
  id: 1,
  takenAt: 0,
  importedAt: 0,
  source: "Moongazer",
  uid,
  summary: {
    characters,
    weapons,
    artifacts,
    materials: 0,
    mora: null,
    primogems: null,
    artifacts4: null,
    artifacts3: null,
    essence: null,
  },
  hasRaw: true,
  review: true,
  session: null,
  live: false,
})

describe("reviewReasons", () => {
  it("names each count that fell as far as auto sync marks for", () => {
    const fewer = text.confirm.fewer
    expect(reviewReasons(snapshot(9, 79, 100), snapshot(10, 100, 100))).toEqual([
      fewer.characters(10, 9),
      fewer.weapons(100, 79),
    ])
    expect(reviewReasons(snapshot(10, 80, 799), snapshot(10, 100, 1000))).toEqual([
      fewer.artifacts(1000, 799),
    ])
  })

  it("says the snapshot can be kept when no rule explains the mark", () => {
    expect(reviewReasons(snapshot(10, 80, 100), snapshot(10, 100, 100))).toEqual([
      text.review.noReason,
    ])
    // Marked once for another account's snapshot before it, now the first of its own.
    expect(reviewReasons(snapshot(1, 1, 1), undefined)).toEqual([text.review.noReason])
  })
})

describe("checkedAgainst", () => {
  const row = (id: number, uid: number | null): Snapshot => ({ ...snapshot(1, 1, 1, uid), id })
  const a = 100000001
  const b = 200000002

  it("takes the newest older snapshot of the same account, passing head rows by", () => {
    const older = [row(-4, a), row(3, b), row(2, a), row(1, a)]
    expect(checkedAgainst(row(5, a), older)?.id).toBe(2)
    expect(checkedAgainst(row(5, b), older)?.id).toBe(3)
  })

  it("has none for an account's first snapshot", () => {
    expect(checkedAgainst(row(5, b), [row(2, a), row(1, a)])).toBeUndefined()
  })

  it("takes the newest of any account for a snapshot without a UID", () => {
    expect(checkedAgainst(row(5, null), [row(-4, a), row(3, b), row(2, a)])?.id).toBe(3)
  })
})

describe("deleteTakes", () => {
  const row = (id: number, takenAt: number, session: number | null): Snapshot => ({
    ...snapshot(1, 1, 1),
    id,
    takenAt,
    session,
  })
  const login = row(1, 1000, 1)
  const middle = row(2, 2000, 1)
  const close = row(3, 3000, 1)
  const head = row(-9, 4000, 1)

  it("names a login snapshot's whole session and the newest snapshot's later changes", () => {
    const list = [head, close, middle, login]
    expect(deleteTakes(login, list)).toBe(text.review.takesSession)
    expect(deleteTakes(close, list)).toBe(text.review.takesLatest)
    expect(deleteTakes(middle, list)).toBeNull()
  })

  it("takes nothing with an import", () => {
    expect(deleteTakes(row(5, 5000, null), [row(5, 5000, null)])).toBeNull()
  })
})
