// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** Where a dragged item goes and how the others make way (useDragOrder), as plain numbers. */

/** A box in viewport pixels, as getBoundingClientRect gives it. */
export type Box = { left: number; top: number; width: number; height: number }
export type Point = { x: number; y: number }

/** `list` with its item at `from` moved to `to`; a copy as it was when either is out of range. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list]
  return list.toSpliced(from, 1).toSpliced(to, 0, ...list.slice(from, from + 1))
}

/**
 * The slot a dragged item goes to with the pointer at `point`: the one the
 * pointer is over, else the nearest, ties to the nearer centre; -1 for none.
 */
export function targetIndex(point: Point, slots: readonly Box[]): number {
  let best = -1
  let bestGap = Number.POSITIVE_INFINITY
  let bestCentre = Number.POSITIVE_INFINITY
  for (const [index, slot] of slots.entries()) {
    const right = slot.left + slot.width
    const bottom = slot.top + slot.height
    const gap = Math.hypot(
      Math.max(slot.left - point.x, 0, point.x - right),
      Math.max(slot.top - point.y, 0, point.y - bottom),
    )
    const centre = Math.hypot(point.x - (slot.left + right) / 2, point.y - (slot.top + bottom) / 2)
    if (gap < bestGap || (gap === bestGap && centre < bestCentre)) {
      best = index
      bestGap = gap
      bestCentre = centre
    }
  }
  return best
}

/**
 * How far each item moves while the one at `from` is held over slot `to`:
 * each takes the slot of its place in the new order.
 */
export function previewShifts(slots: readonly Box[], from: number, to: number): Point[] {
  const order = moveItem(
    slots.map((_, index) => index),
    from,
    to,
  )
  return slots.map((slot, index) => {
    const target = slots[order.indexOf(index)] ?? slot
    return { x: target.left - slot.left, y: target.top - slot.top }
  })
}

const EDGE = 56
const MAX_SPEED = 16

/** Pixels a frame to scroll by with the pointer at `y`, near or past a scroller's top or bottom. */
export function edgeSpeed(y: number, top: number, bottom: number): number {
  if (y < top + EDGE) return -Math.ceil(MAX_SPEED * Math.min(1, (top + EDGE - y) / EDGE))
  if (y > bottom - EDGE) return Math.ceil(MAX_SPEED * Math.min(1, (y - bottom + EDGE) / EDGE))
  return 0
}
