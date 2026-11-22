// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { KeyboardEvent } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { moveItem } from "./dragGeometry"
import { useDragOrder } from "./useDragOrder"

const ROW = 100

type Slide = { y: number; cancelled: boolean }

/**
 * An item in a column: it lies ROW px under the one before and is drawn off
 * that by its latest slide not cancelled (a new one replaces the old), frozen
 * at its start. It notes whether it was marked data-moved each time its place
 * was read.
 */
class Item {
  readonly style = {}
  readonly isConnected = true
  readonly marks = new Set<string>()
  readonly slides: Slide[] = []
  readonly reads: boolean[] = []
  readonly parentNode: Column
  constructor(column: Column) {
    this.parentNode = column
  }
  setAttribute(name: string) {
    this.marks.add(name)
  }
  removeAttribute(name: string) {
    this.marks.delete(name)
  }
  focus() {}
  drawnAt() {
    const at = this.parentNode.items.indexOf(this) * ROW
    return at + (this.slides.findLast(slide => !slide.cancelled)?.y ?? 0)
  }
  getBoundingClientRect() {
    this.reads.push(this.marks.has("data-moved"))
    return { left: 0, top: this.drawnAt(), width: 100, height: ROW - 10 }
  }
  animate(frames: Keyframe[]) {
    const y = Number.parseFloat(String(frames[0]?.translate).split(" ")[1] ?? "")
    const slide = { y, cancelled: false }
    this.slides.push(slide)
    return {
      cancel: () => {
        slide.cancelled = true
      },
    }
  }
}

/** A list in the page, which tells its watchers of each item put in. */
class Column {
  items: Item[] = []
  readonly watchers = new Set<Watcher>()
  insertBefore(item: Item, before: Item | null) {
    this.items = this.items.filter(other => other !== item)
    this.items.splice(before ? this.items.indexOf(before) : this.items.length, 0, item)
    for (const watcher of this.watchers) watcher.records.push({ addedNodes: [item] })
  }
}

class Watcher {
  records: { addedNodes: Item[] }[] = []
  observe(column: Column) {
    column.watchers.add(this)
  }
  takeRecords() {
    return this.records.splice(0)
  }
  disconnect() {}
}

/** The hook reads and writes only what Item has. */
function asElement(item: Item) {
  return item as unknown as HTMLElement
}

type Held = { order?: ReturnType<typeof useDragOrder> }

/** Hands the hook out for the test to drive. */
function Probe({ held, move }: { held: Held; move: (from: number, to: number) => void }) {
  held.order = useDragOrder(move)
  return null
}

/**
 * A column of `count` items under the hook. A move puts them in order as
 * React does keyed children: the ones that fall behind are taken out and put
 * in again before the next that stays. The focus is on the item moved, which
 * React puts back, reading the layout.
 */
function setUp(count: number) {
  const column = new Column()
  column.items = Array.from({ length: count }, () => new Item(column))
  const held: Held = {}
  const move = (from: number, to: number) => {
    const next = moveItem(column.items, from, to)
    let last = -1
    const stays = next.map(item => {
      const at = column.items.indexOf(item)
      if (at > last) last = at
      return at === last
    })
    for (const [i, item] of next.entries()) {
      if (!stays[i]) column.insertBefore(item, next.find((_, j) => j > i && stays[j]) ?? null)
    }
    next[to]?.getBoundingClientRect()
    attach()
  }
  renderToStaticMarkup(<Probe held={held} move={move} />)
  const { order } = held
  if (!order) throw new Error("no hook")
  function attach() {
    for (const [i, item] of column.items.entries()) order?.item(i).ref(asElement(item))
  }
  attach()
  const press = (key: string, item: Item) => {
    const event = { key, preventDefault() {}, currentTarget: asElement(item) }
    order.handle(column.items.indexOf(item)).onKeyDown(event as KeyboardEvent<HTMLElement>)
  }
  return { column, press }
}

beforeEach(() => {
  vi.stubGlobal("MutationObserver", Watcher)
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }))
  vi.stubGlobal("document", { activeElement: null, documentElement: { dataset: {} } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useDragOrder", () => {
  it("keeps an item moved in the page marked while its new place is read", () => {
    const { column, press } = setUp(2)
    const [a, b] = column.items
    if (!a || !b) throw new Error("no items")
    press("ArrowDown", a)
    expect(column.items).toEqual([b, a])
    // Read where it was, unmarked, then in React's commit and where it went, marked; the one
    // React left is never marked.
    expect(a.reads).toEqual([false, true, true])
    expect(b.reads).toEqual([false, false])
    expect([...a.marks, ...b.marks]).toEqual([])
  })

  it("starts a second slide where the first draws the item", () => {
    const { column, press } = setUp(3)
    const [a] = column.items
    if (!a) throw new Error("no items")
    press("ArrowDown", a)
    expect(a.drawnAt()).toBe(0)
    press("ArrowDown", a)
    expect(column.items.indexOf(a)).toBe(2)
    expect(a.drawnAt()).toBe(0)
    expect(a.slides.map(slide => slide.cancelled)).toEqual([true, false])
  })
})
