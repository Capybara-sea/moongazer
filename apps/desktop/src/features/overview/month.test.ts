// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Snapshot, Summary } from "@/lib/backend"
import { monthBounds, monthOf, monthRows } from "./month"

/** Local time in November 2026 unless another month (0-based) is given. */
const at = (day: number, hour = 12, month = 10, year = 2026) =>
  new Date(year, month, day, hour).getTime()

const snapshot = (takenAt: number, summary: Partial<Summary>): Snapshot => ({
  id: takenAt,
  takenAt,
  importedAt: takenAt,
  source: "Teyvat.me",
  uid: null,
  summary: {
    characters: 1,
    weapons: 1,
    artifacts: 1,
    materials: 1,
    mora: null,
    primogems: null,
    artifacts4: null,
    artifacts3: null,
    essence: null,
    ...summary,
  },
  hasRaw: true,
  review: false,
  session: null,
  live: false,
})

const november = monthOf(at(1))

describe("monthRows", () => {
  it("lists the month's days with snapshots, newest first, by each day's last snapshot", () => {
    const snapshots = [
      snapshot(at(1, 9, 11), { primogems: 999 }),
      snapshot(at(5), { primogems: 150 }),
      snapshot(at(2, 21), { primogems: 150 }),
      snapshot(at(2, 9), { primogems: 120 }),
      snapshot(at(31, 12, 9), { primogems: 100 }),
    ]
    const rows = monthRows(snapshots, november)
    expect(rows.map(row => row.day)).toEqual([at(5, 0), at(2, 0)])
    expect(rows.map(row => row.primogems)).toEqual([
      { value: 150, delta: 0 },
      { value: 150, delta: 50 },
    ])
  })

  it("compares each column with the last earlier day that had it", () => {
    const snapshots = [
      snapshot(at(3), { mora: 1500, artifacts4: 6, artifacts3: 6, essence: 52 }),
      snapshot(at(2), { artifacts4: 5, artifacts3: 6, essence: 40 }),
      snapshot(at(1), { mora: 1000 }),
    ]
    const [third, second, first] = monthRows(snapshots, november)
    expect(third).toEqual({
      day: at(3, 0),
      primogems: null,
      mora: { value: 1500, delta: 500 },
      artifacts4: { value: 6, delta: 1 },
      artifacts3: { value: 6, delta: 0 },
      essence: { value: 52, delta: 12 },
    })
    expect(second?.mora).toBeNull()
    expect(second?.essence).toEqual({ value: 40, delta: null })
    expect(first?.mora).toEqual({ value: 1000, delta: null })
  })

  it("keeps a value read earlier in the day when a later file lacks it", () => {
    const snapshots = [snapshot(at(2, 20), {}), snapshot(at(2, 8), { mora: 100 })]
    expect(monthRows(snapshots, november)[0]?.mora).toEqual({ value: 100, delta: null })
  })

  it("takes the later import when two snapshots share a time", () => {
    const snapshots = [
      { ...snapshot(at(2), { mora: 200 }), id: 2 },
      { ...snapshot(at(2), { mora: 100 }), id: 1 },
    ]
    expect(monthRows(snapshots, november)[0]?.mora).toEqual({ value: 200, delta: null })
  })

  it("takes a file without any 4-star or 3-star artifact as filtered, not as zero", () => {
    const snapshots = [
      snapshot(at(3), { artifacts4: 0, artifacts3: 0 }),
      snapshot(at(2), { artifacts4: 5, artifacts3: 7 }),
    ]
    const [third] = monthRows(snapshots, november)
    expect(third?.artifacts4).toBeNull()
    expect(third?.artifacts3).toBeNull()
  })

  it("has no rows for a month without snapshots", () => {
    const snapshots = [snapshot(at(1, 12, 11), { mora: 2 }), snapshot(at(1, 12, 9), { mora: 1 })]
    expect(monthRows(snapshots, november)).toEqual([])
  })
})

describe("monthBounds", () => {
  it("spans the months of the oldest and newest snapshot", () => {
    const snapshots = [snapshot(at(16), {}), snapshot(at(20, 12, 11, 2025), {})]
    expect(monthBounds(snapshots)).toEqual({ first: 2025 * 12 + 11, last: 2026 * 12 + 10 })
    expect(monthBounds([])).toBeNull()
  })
})
