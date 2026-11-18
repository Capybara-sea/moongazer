// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Snapshot } from "@/lib/backend"
import { bucketLabel, buildBuckets, changeBars, labelBuckets, plotSeries } from "./trend"

/** Local time in November 2026 unless another month (0-based) is given. */
const at = (day: number, hour = 0, month = 10, year = 2026) =>
  new Date(year, month, day, hour).getTime()

const snapshot = (takenAt: number, mora: number | null, primogems = mora): Snapshot => ({
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
    mora,
    primogems,
    artifacts4: 0,
    artifacts3: 0,
    essence: 0,
  },
  hasRaw: true,
  review: false,
  session: null,
  live: false,
})

const now = at(17, 10)

describe("buildBuckets", () => {
  it("takes each day's last snapshot and carries the value over days without one", () => {
    const snapshots = [
      snapshot(at(16, 8), 120),
      snapshot(at(14, 20), 150),
      snapshot(at(14, 9), 100),
    ]
    expect(buildBuckets(snapshots, "mora", "day", 30, now)).toEqual([
      { at: at(14), value: 150, delta: 0 },
      { at: at(15), value: 150, delta: 0 },
      { at: at(16), value: 120, delta: -30 },
      { at: at(17), value: 120, delta: 0 },
    ])
  })

  it("starts at the range when there is older data, and measures the first change from it", () => {
    const snapshots = [snapshot(at(16, 8), 160), snapshot(at(11, 8), 110), snapshot(at(1, 8), 100)]
    const buckets = buildBuckets(snapshots, "mora", "day", 7, now)
    expect(buckets).toHaveLength(7)
    expect(buckets[0]).toEqual({ at: at(11), value: 110, delta: 10 })
    expect(buckets.map(b => b.delta)).toEqual([10, 0, 0, 0, 0, 50, 0])
  })

  it("leaves out snapshots without the currency, series by series", () => {
    const snapshots = [
      snapshot(at(17, 8), 140, 7),
      snapshot(at(16, 8), null, 5),
      snapshot(at(15), 100, 3),
    ]
    expect(buildBuckets(snapshots, "mora", "day", 30, now).map(b => b.value)).toEqual([
      100, 100, 140,
    ])
    expect(buildBuckets(snapshots, "primogems", "day", 30, now).map(b => b.value)).toEqual([
      3, 5, 7,
    ])
  })

  it("keeps one point per snapshot in snapshot mode, measured from the one before the range", () => {
    const snapshots = [snapshot(at(16, 8), 160), snapshot(at(12, 8), 130), snapshot(at(1, 8), 100)]
    expect(buildBuckets(snapshots, "mora", "snapshot", 7, now)).toEqual([
      { at: at(12, 8), value: 130, delta: 30 },
      { at: at(16, 8), value: 160, delta: 30 },
    ])
    expect(buildBuckets(snapshots, "mora", "snapshot", "all", now).map(b => b.delta)).toEqual([
      0, 30, 30,
    ])
  })

  it("keeps one point per time, the later import, when snapshots share a time", () => {
    const snapshots = [
      { ...snapshot(at(16, 8), 130), id: 2 },
      { ...snapshot(at(16, 8), 120), id: 1 },
      snapshot(at(15, 8), 100),
    ]
    expect(buildBuckets(snapshots, "mora", "snapshot", "all", now)).toEqual([
      { at: at(15, 8), value: 100, delta: 0 },
      { at: at(16, 8), value: 130, delta: 30 },
    ])
    expect(buildBuckets(snapshots, "mora", "day", 30, now).map(b => b.value)).toEqual([
      100, 130, 130,
    ])
  })

  it("limits hour mode to the last week whatever the range", () => {
    const buckets = buildBuckets(
      [snapshot(at(1, 8), 100)],
      "mora",
      "hour",
      90,
      at(17, 10) + 1_800_000,
    )
    expect(buckets).toHaveLength(168)
    expect(buckets.at(-1)?.at).toBe(at(17, 10))
    expect(buckets.every(b => b.value === 100 && b.delta === 0)).toBe(true)
  })

  it("covers the whole history by month and by year", () => {
    const snapshots = [snapshot(at(3, 8, 1), 300), snapshot(at(20, 8, 11, 2025), 100)]
    const march = at(5, 8, 2)
    expect(buildBuckets(snapshots, "mora", "month", 7, march)).toEqual([
      { at: at(1, 0, 11, 2025), value: 100, delta: 0 },
      { at: at(1, 0, 0), value: 100, delta: 0 },
      { at: at(1, 0, 1), value: 300, delta: 200 },
      { at: at(1, 0, 2), value: 300, delta: 0 },
    ])
    expect(buildBuckets(snapshots, "mora", "year", 7, march)).toEqual([
      { at: at(1, 0, 0, 2025), value: 100, delta: 0 },
      { at: at(1, 0, 0), value: 300, delta: 200 },
    ])
  })

  it("returns nothing when no snapshot has the currency", () => {
    expect(buildBuckets([], "mora", "day", 30, now)).toEqual([])
    expect(buildBuckets([snapshot(at(16), null)], "mora", "day", 30, now)).toEqual([])
  })
})

describe("labels", () => {
  it("names a snapshot by its time and a bucket by its hour, day, month or year", () => {
    const time = new Date(2026, 10, 5, 21, 4).getTime()
    expect(bucketLabel(time, "snapshot")).toBe("11-05 21:04")
    expect(bucketLabel(time, "hour")).toBe("11-05 21:00")
    expect(bucketLabel(time, "day")).toBe("11-05")
    expect(bucketLabel(time, "month")).toBe("2026-11")
    expect(bucketLabel(time, "year")).toBe("2026")
  })

  it("labels the first, middle and last bucket once each", () => {
    const starts = (n: number) => labelBuckets(buckets(Array(n).fill(1))).map(b => b.at)
    expect(starts(30)).toEqual([0, 15, 29])
    expect(starts(2)).toEqual([0, 1])
    expect(starts(1)).toEqual([0])
  })
})

function buckets(values: number[], deltas = values.map(() => 0)) {
  return values.map((value, i) => ({ at: i, value, delta: deltas[i] ?? 0 }))
}

describe("plotSeries", () => {
  it("draws a stepped line on a scale padded by a tenth at each end", () => {
    const plot = plotSeries(buckets([100, 200, 150]))
    expect(plot.ticks).toEqual([210, 170, 130, 90])
    expect(plot.line).toBe("M0 137.5 H300 V12.5 H600 V75")
    expect(plot.area).toBe("M0 137.5 H300 V12.5 H600 V75 V150 H0 Z")
    expect(plot.point(1)).toEqual({ x: 0.5, y: 12.5 / 150 })
  })

  it("draws a single value across the middle", () => {
    const plot = plotSeries(buckets([3280]))
    expect(plot.line).toBe("M0 75 H600")
    expect(plot.point(0)).toEqual({ x: 0.5, y: 0.5 })
  })

  it("keeps the scale at zero or above", () => {
    expect(plotSeries(buckets([0, 1000])).ticks.at(-1)).toBe(0)
  })
})

describe("changeBars", () => {
  it("puts the zero line where the largest gain and loss both fit", () => {
    expect(changeBars(buckets([0, 0, 0], [0, 30, -10]))).toEqual({
      zero: 0.75,
      gain: 30,
      bars: [
        { at: 0, top: 0.75, height: 0, loss: false },
        { at: 1, top: 0, height: 0.75, loss: false },
        { at: 2, top: 0.75, height: 0.25, loss: true },
      ],
    })
  })

  it("gives losses a third of the strip at most, so gains stay readable", () => {
    const strip = changeBars(buckets([0, 0, 0], [0, 10, -90]))
    expect(strip.zero).toBeCloseTo(2 / 3)
    expect(strip.bars[1]?.height).toBeCloseTo(2 / 3)
    expect(strip.bars[2]?.height).toBeCloseTo(1 / 3)
    expect(changeBars(buckets([0, 0], [0, -5])).zero).toBeCloseTo(2 / 3)
  })

  it("keeps the zero line at the bottom when nothing changed", () => {
    const strip = changeBars(buckets([5, 5]))
    expect(strip.zero).toBe(1)
    expect(strip.bars.every(bar => bar.height === 0)).toBe(true)
  })
})
