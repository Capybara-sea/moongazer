// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Snapshot } from "@/lib/backend"
import { historyItems } from "./sessions"

const row = (id: number, session: number | null, patch: Partial<Snapshot> = {}): Snapshot => ({
  id,
  takenAt: Math.abs(id) * 1000,
  importedAt: Math.abs(id) * 1000,
  source: "Fake",
  uid: null,
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
  ...patch,
})

describe("historyItems", () => {
  it("takes each session's rows together, newest and oldest, where its newest row is", () => {
    const head = row(-9, 5, { live: true })
    const saved = row(7, 5)
    const login = row(5, 5)
    const imported = row(4, null)
    const earlier = row(3, 2, { review: true })
    const earlierLogin = row(2, 2)
    const old = row(1, null)
    const items = historyItems([head, saved, login, imported, earlier, earlierLogin, old])
    expect(items).toEqual([
      { kind: "session", session: 5, newest: head, oldest: login, live: true, review: false },
      { kind: "snapshot", snapshot: imported, index: 3 },
      {
        kind: "session",
        session: 2,
        newest: earlier,
        oldest: earlierLogin,
        live: false,
        review: true,
      },
      { kind: "snapshot", snapshot: old, index: 6 },
    ])
  })

  it("keeps a session one row when an import falls between its snapshots", () => {
    const closed = row(8, 5)
    const imported = row(6, null)
    const login = row(5, 5)
    expect(historyItems([closed, imported, login])).toEqual([
      { kind: "session", session: 5, newest: closed, oldest: login, live: false, review: false },
      { kind: "snapshot", snapshot: imported, index: 1 },
    ])
  })

  it("has nothing for no snapshots", () => {
    expect(historyItems([])).toEqual([])
  })
})
