// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { type Box, edgeSpeed, moveItem, previewShifts, targetIndex } from "./dragGeometry"

/** Two columns of 100 × 80 slots, 16 px apart, filled row by row. */
function grid(count: number): Box[] {
  return Array.from({ length: count }, (_, i) => ({
    left: (i % 2) * 116,
    top: Math.floor(i / 2) * 96,
    width: 100,
    height: 80,
  }))
}

describe("moveItem", () => {
  it("moves an item forward or back, the others keeping their order", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"])
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"])
  })

  it("leaves a copy as it was in place or out of range", () => {
    const list = ["a", "b"]
    expect(moveItem(list, 1, 1)).toEqual(list)
    expect(moveItem(list, 0, 2)).toEqual(list)
    expect(moveItem(list, -1, 0)).toEqual(list)
    expect(moveItem(list, 1, 1)).not.toBe(list)
  })
})

describe("targetIndex", () => {
  it("picks the slot the pointer is over, in either column", () => {
    const slots = grid(5)
    expect(targetIndex({ x: 50, y: 40 }, slots)).toBe(0)
    expect(targetIndex({ x: 150, y: 40 }, slots)).toBe(1)
    expect(targetIndex({ x: 150, y: 120 }, slots)).toBe(3)
    expect(targetIndex({ x: 10, y: 200 }, slots)).toBe(4)
  })

  it("picks the nearest slot from a gap or past the edges", () => {
    const slots = grid(5)
    // Between the columns, nearer the second.
    expect(targetIndex({ x: 110, y: 40 }, slots)).toBe(1)
    // Below the last row, under its empty half: the last item.
    expect(targetIndex({ x: 170, y: 260 }, slots)).toBe(4)
    expect(targetIndex({ x: -40, y: -40 }, slots)).toBe(0)
  })

  it("goes by the slots' edges, not only their centres, when they differ in size", () => {
    const slots: Box[] = [
      { left: 0, top: 0, width: 100, height: 400 },
      { left: 0, top: 416, width: 100, height: 100 },
    ]
    // Nearer the second slot's centre, but still over the first.
    expect(targetIndex({ x: 50, y: 380 }, slots)).toBe(0)
  })

  it("finds nothing without slots", () => {
    expect(targetIndex({ x: 0, y: 0 }, [])).toBe(-1)
  })

  it("reads a row of chips along it", () => {
    const chips: Box[] = [0, 70, 140].map(left => ({ left, top: 0, width: 60, height: 28 }))
    expect(targetIndex({ x: 170, y: 14 }, chips)).toBe(2)
    expect(targetIndex({ x: 66, y: 40 }, chips)).toBe(1)
  })
})

describe("previewShifts", () => {
  it("shifts the items between back a slot as one is held further on", () => {
    const slots = grid(4)
    expect(previewShifts(slots, 0, 2)).toEqual([
      { x: 0, y: 96 },
      { x: -116, y: 0 },
      { x: 116, y: -96 },
      { x: 0, y: 0 },
    ])
  })

  it("shifts them on a slot as one is held further back", () => {
    const slots = grid(3)
    expect(previewShifts(slots, 2, 0)).toEqual([
      { x: 116, y: 0 },
      { x: -116, y: 96 },
      { x: 0, y: -96 },
    ])
  })

  it("shifts nothing over its own slot", () => {
    expect(previewShifts(grid(3), 1, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ])
  })
})

describe("edgeSpeed", () => {
  it("scrolls only near or past the top and bottom, faster closer in", () => {
    expect(edgeSpeed(300, 0, 600)).toBe(0)
    expect(edgeSpeed(56, 0, 600)).toBe(0)
    expect(edgeSpeed(55, 0, 600)).toBe(-1)
    expect(edgeSpeed(28, 0, 600)).toBe(-8)
    expect(edgeSpeed(0, 0, 600)).toBe(-16)
    expect(edgeSpeed(-50, 0, 600)).toBe(-16)
    expect(edgeSpeed(572, 0, 600)).toBe(8)
    expect(edgeSpeed(700, 0, 600)).toBe(16)
  })
})
