// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { flushSync } from "react-dom"
import { type Box, edgeSpeed, type Point, previewShifts, targetIndex } from "@/lib/dragGeometry"
import { motionAllowed } from "@/lib/motion"

export type DragItemProps = {
  ref: (el: HTMLElement | null) => void
  "data-drag-item": ""
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
}

export type DragHandleProps = {
  "data-drag-handle": ""
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
}

const LIFT = 1.03
const LIFT_MS = 180
const SLIDE_MS = 200
const START_PX = 5
/** A press on one of these inside an item is the control's, unless it is a drag handle. */
const CONTROLS =
  "a, button, input, select, textarea, label, [role='button'], [role='switch'], [role='checkbox']"
const STEPS: Record<string, number> = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }

/**
 * Reordering a list by dragging its items, or by the arrow keys on a handle.
 * A press becomes a drag once it moves a few pixels, so clicks keep working.
 * The item held follows the pointer, lifted (data-dragging; the look is in
 * index.css), and the others slide to where they would go. On release the
 * order is saved with `onMove` at once and every item slides from where it is
 * drawn to its new place; Escape or a lost pointer slides them all back.
 * `rearrange` runs another change to the list (one removed, one resized) with
 * the same slide. With motion off, items jump.
 */
export function useDragOrder(onMove: (from: number, to: number) => void) {
  const latest = useRef(onMove)
  useLayoutEffect(() => {
    latest.current = onMove
  })
  const [order] = useState(() => dragOrder((from, to) => latest.current(from, to)))
  useEffect(() => {
    return () => order.dispose()
  }, [order])
  return order
}

type Live = {
  items: HTMLElement[]
  /** Where the items were as the drag began; the target is read against these. */
  slots: Box[]
  to: number
  scroller: HTMLElement | null
  scrollFrom: number
  /** Read once: the item held, moved past the end, would make room to scroll on forever. */
  scrollMax: number
  edges: { top: number; bottom: number }
}

type Press = {
  pointer: number
  index: number
  item: HTMLElement
  start: Point
  at: Point
  live: Live | null
  /** Put back with Escape while the button is still down. */
  dropped: boolean
}

function dragOrder(move: (from: number, to: number) => void) {
  const items: (HTMLElement | null)[] = []
  const refs: ((el: HTMLElement | null) => void)[] = []
  const running = new Map<HTMLElement, Animation>()
  let press: Press | null = null
  let frame = 0

  const listed = () => items.filter((el): el is HTMLElement => el !== null)

  function item(index: number): DragItemProps {
    const ref =
      refs[index] ??
      ((el: HTMLElement | null) => {
        items[index] = el
      })
    refs[index] = ref
    return { ref, "data-drag-item": "", onPointerDown: e => down(e, index) }
  }

  function handle(index: number): DragHandleProps {
    return {
      "data-drag-handle": "",
      onKeyDown: e => {
        const step = STEPS[e.key]
        if (step === undefined) return
        e.preventDefault()
        const to = index + step
        if (press || to < 0 || to >= listed().length) return
        const target = e.currentTarget
        rearrange(() => move(index, to))
        // React moved it in the page, which took the focus away.
        if (document.activeElement !== target) target.focus()
      },
    }
  }

  /** Runs `change`, which re-renders the items, and slides each from where it was. */
  function rearrange(change: () => void) {
    const before = listed()
    const first = before.map(el => el.getBoundingClientRect())
    const moved = commit(before, change)
    slide(before, first)
    for (const el of moved) el.removeAttribute("data-moved")
  }

  /**
   * Runs `change` at once and returns the items it moved in the page, still
   * marked data-moved: Chromium styles a moved element as if new, and the
   * rise-ins in index.css, which leave [data-moved] out, would play on it
   * again. All are marked before, as React reads the layout in its commit when
   * the focus was in one it moved.
   */
  function commit(els: HTMLElement[], change: () => void) {
    const watch = new MutationObserver(() => undefined)
    for (const el of els) {
      el.setAttribute("data-moved", "")
      if (el.parentNode) watch.observe(el.parentNode, { childList: true })
    }
    flushSync(change)
    const added = new Set(watch.takeRecords().flatMap(record => Array.from(record.addedNodes)))
    watch.disconnect()
    for (const el of els) if (!added.has(el)) el.removeAttribute("data-moved")
    return els.filter(el => added.has(el))
  }

  function down(e: ReactPointerEvent<HTMLElement>, index: number) {
    const { target, currentTarget } = e
    // Events from a popover a card opens come through the card too, though it is not in it.
    if (press || e.button !== 0 || !e.isPrimary || !(target instanceof Element)) return
    if (!currentTarget.contains(target)) return
    const control = target.closest(CONTROLS)
    if (control && currentTarget.contains(control) && !control.hasAttribute("data-drag-handle")) {
      return
    }
    const at = { x: e.clientX, y: e.clientY }
    press = {
      pointer: e.pointerId,
      index,
      item: currentTarget,
      start: at,
      at,
      live: null,
      dropped: false,
    }
    window.addEventListener("pointermove", pointerMove)
    window.addEventListener("pointerup", pointerUp)
    window.addEventListener("pointercancel", cancel)
    window.addEventListener("keydown", putBack, { capture: true })
  }

  function begin(p: Press) {
    for (const animation of running.values()) animation.finish()
    const list = listed()
    const scroller = scrollParent(p.item)
    const edges = scroller?.getBoundingClientRect()
    p.live = {
      items: list,
      slots: list.map(el => el.getBoundingClientRect()),
      to: p.index,
      scroller,
      scrollFrom: scroller?.scrollTop ?? 0,
      scrollMax: scroller ? scroller.scrollHeight - scroller.clientHeight : 0,
      edges: { top: edges?.top ?? 0, bottom: edges?.bottom ?? 0 },
    }
    const motion = motionAllowed()
    for (const el of list) {
      const moves = el === p.item ? `scale ${LIFT_MS}ms` : `translate ${SLIDE_MS}ms`
      el.style.transition = motion ? `${moves} var(--ease-out-soft)` : "none"
      el.style.translate = "0px 0px"
    }
    p.item.style.scale = String(LIFT)
    p.item.style.zIndex = "10"
    p.item.setAttribute("data-dragging", "")
    p.item.setPointerCapture(p.pointer)
    p.item.addEventListener("lostpointercapture", cancel)
    scroller?.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("click", swallow, { capture: true })
  }

  function schedule() {
    if (frame !== 0) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (press) render(press, true)
    })
  }

  /** One frame of a drag: one read (the scroll), then the writes. */
  function render(p: Press, scroll: boolean) {
    const live = p.live
    if (!live || p.dropped) return
    const scrolled = live.scroller ? live.scroller.scrollTop : 0
    const shift = scrolled - live.scrollFrom
    const { at, start, item, index } = p
    item.style.translate = `${at.x - start.x}px ${at.y - start.y + shift}px`
    const to = Math.max(0, targetIndex({ x: at.x, y: at.y + shift }, live.slots))
    if (to !== live.to) {
      live.to = to
      const shifts = previewShifts(live.slots, index, to)
      for (const [i, el] of live.items.entries()) {
        const by = shifts[i]
        if (el !== item && by) el.style.translate = `${by.x}px ${by.y}px`
      }
    }
    if (!live.scroller || !scroll) return
    const speed = edgeSpeed(at.y, live.edges.top, live.edges.bottom)
    const next = Math.min(live.scrollMax, Math.max(0, scrolled + speed))
    // Its scroll event brings the next frame, till the pointer leaves the edge or the end comes.
    if (next !== scrolled) live.scroller.scrollTop = next
  }

  function pointerMove(e: PointerEvent) {
    const p = press
    if (!p || e.pointerId !== p.pointer || p.dropped) return
    p.at = { x: e.clientX, y: e.clientY }
    if (!p.live) {
      if (Math.hypot(p.at.x - p.start.x, p.at.y - p.start.y) < START_PX) return
      begin(p)
    }
    schedule()
  }

  function pointerUp(e: PointerEvent) {
    const p = press
    if (!p || e.pointerId !== p.pointer) return
    end()
    if (p.live && !p.dropped) {
      render(p, false)
      settle(p, p.live.to)
    }
    // The click this release makes comes in the same task; later ones go through.
    if (p.live) setTimeout(() => window.removeEventListener("click", swallow, { capture: true }))
  }

  function cancel(e: PointerEvent) {
    const p = press
    if (!p || e.pointerId !== p.pointer) return
    end()
    window.removeEventListener("click", swallow, { capture: true })
    if (p.live && !p.dropped) settle(p, p.index)
  }

  function putBack(e: globalThis.KeyboardEvent) {
    const p = press
    if (e.key !== "Escape" || !p?.live || p.dropped) return
    // Stopped before a dialog around the list takes it and closes.
    e.preventDefault()
    e.stopPropagation()
    p.dropped = true
    settle(p, p.index)
  }

  /** Lets go of the pointer; the items stay as they are drawn. */
  function end() {
    const p = press
    press = null
    cancelAnimationFrame(frame)
    frame = 0
    window.removeEventListener("pointermove", pointerMove)
    window.removeEventListener("pointerup", pointerUp)
    window.removeEventListener("pointercancel", cancel)
    window.removeEventListener("keydown", putBack, { capture: true })
    p?.item.removeEventListener("lostpointercapture", cancel)
    p?.live?.scroller?.removeEventListener("scroll", schedule)
  }

  /** Saves the item held at `to` (or leaves it), and slides everything to its place. */
  function settle(p: Press, to: number) {
    const live = p.live
    if (!live) return
    const lift = Number.parseFloat(getComputedStyle(p.item).scale) || 1
    const first = live.items.map(el => el.getBoundingClientRect())
    const moved = to === p.index ? [] : commit(live.items, () => move(p.index, to))
    p.item.removeAttribute("data-dragging")
    for (const el of live.items) {
      el.style.translate = ""
      el.style.scale = ""
      el.style.transition = ""
      el.style.zIndex = ""
    }
    slide(live.items, first, { item: p.item, lift })
    for (const el of moved) el.removeAttribute("data-moved")
  }

  /**
   * Slides each of `els` from where it was drawn (`first`) to where it is now
   * (FLIP); one that was `held` also settles from its lift, staying on top.
   */
  function slide(els: HTMLElement[], first: Box[], held?: { item: HTMLElement; lift: number }) {
    // Cancelled before `last` is read: `first` has an item where a slide under way draws it, and
    // the new slide starts from there.
    for (const el of els) {
      running.get(el)?.cancel()
      running.delete(el)
    }
    if (!motionAllowed()) return
    const last = els.map(el => (el.isConnected ? el.getBoundingClientRect() : undefined))
    const easing =
      getComputedStyle(document.documentElement).getPropertyValue("--ease-out-soft").trim() ||
      "ease-out"
    for (const [i, el] of els.entries()) {
      const [was, now] = [first[i], last[i]]
      if (!was || !now) continue
      const lift = el === held?.item ? held.lift : 1
      // A lifted item is scaled about its centre: where it lies unscaled.
      const dx = was.left + (was.width - was.width / lift) / 2 - now.left
      const dy = was.top + (was.height - was.height / lift) / 2 - now.top
      const lifted = el === held?.item
      if (!lifted && Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      const translate = `${dx}px ${dy}px`
      const frames: Keyframe[] = lifted
        ? [
            { translate, scale: String(lift), zIndex: 10 },
            { translate: "0px 0px", scale: "1", zIndex: 10 },
          ]
        : [{ translate }, { translate: "0px 0px" }]
      const animation = el.animate(frames, { duration: SLIDE_MS, easing })
      running.set(el, animation)
      animation.onfinish = () => {
        if (running.get(el) === animation) running.delete(el)
      }
    }
  }

  function dispose() {
    end()
    window.removeEventListener("click", swallow, { capture: true })
  }

  return { item, handle, rearrange, dispose }
}

/** The nearest ancestor that scrolls vertically, looked for once as a drag begins. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let at = el.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at)
    const scrolls = overflowY === "auto" || overflowY === "scroll"
    if (scrolls && at.scrollHeight > at.clientHeight) return at
  }
  return null
}

/** Stops the click that ends a drag from also pressing what it was let go over. */
function swallow(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}
