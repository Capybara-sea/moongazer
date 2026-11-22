// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTip } from "./Tip"

type Mount = { slots: unknown[]; at: number; render: () => void }

/**
 * Just enough of React's hooks to run useTip with no DOM: each mount keeps
 * its own state, and setting it renders the mount again at once. Effects do
 * not run.
 */
const hooks = vi.hoisted(() => ({ current: undefined as Mount | undefined }))

vi.mock("react", async original => {
  const slot = (make: () => unknown) => {
    const mount = hooks.current
    if (!mount) throw new Error("a hook outside a mount")
    const at = mount.at++
    if (!(at in mount.slots)) mount.slots[at] = make()
    return { mount, at }
  }
  return {
    ...(await original<typeof import("react")>()),
    useState(initial: unknown) {
      const { mount, at } = slot(() => initial)
      const set = (value: unknown) => {
        mount.slots[at] = value
        mount.render()
      }
      return [mount.slots[at], set]
    },
    useRef(initial: unknown) {
      const { mount, at } = slot(() => ({ current: initial }))
      return mount.slots[at]
    },
    useEffect() {},
  }
})

/** An element in a tree; closest("[data-tip]") finds it when it has a tip. */
class Box {
  readonly parentElement: Box | null
  readonly tipped: boolean
  constructor(parentElement: Box | null, tipped: boolean) {
    this.parentElement = parentElement
    this.tipped = tipped
  }
  closest(selector: string): Box | null {
    expect(selector).toBe("[data-tip]")
    return this.tipped ? this : (this.parentElement?.closest(selector) ?? null)
  }
}

type Probe = Mount & { content: ReactNode; tip: ReturnType<typeof useTip> }

type Handlers = {
  ref: { current: unknown }
  onPointerEnter: (event: { pointerType: string }) => void
  onPointerLeave: () => void
  onPointerDown: () => void
}

const MOUSE = { pointerType: "mouse" }

/** Stands in for a component: runs useTip and keeps what it returns. */
function Probed(probe: Probe) {
  const before = hooks.current
  hooks.current = probe
  probe.at = 0
  probe.tip = useTip(probe.content)
  hooks.current = before
}

/** useTip in a component, rendered again whenever its state changes. */
function mount(content: ReactNode) {
  const probe: Probe = {
    slots: [],
    at: 0,
    render: () => Probed(probe),
    content,
    tip: { props: {}, bubble: null },
  }
  probe.render()
  return probe
}

/** Puts the probe's props on `box`, as a component spreads them, and hands out the handlers. */
function spread(probe: Probe, box: Box) {
  const handlers = probe.tip.props as unknown as Handlers
  handlers.ref.current = box
  return handlers
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("window", globalThis)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("useTip", () => {
  it("gives no props and no bubble without content", () => {
    for (const content of [undefined, null, false, ""]) {
      expect(mount(content).tip).toEqual({ props: {}, bubble: null })
    }
  })

  it("opens after the pointer rests, and closes when it leaves or presses", () => {
    const probe = mount("Name")
    const on = spread(probe, new Box(null, false))
    on.onPointerEnter(MOUSE)
    vi.advanceTimersByTime(399)
    expect(probe.tip.bubble).toBeNull()
    vi.advanceTimersByTime(1)
    expect(probe.tip.bubble).not.toBeNull()
    on.onPointerLeave()
    expect(probe.tip.bubble).toBeNull()

    on.onPointerEnter(MOUSE)
    vi.advanceTimersByTime(400)
    expect(probe.tip.bubble).not.toBeNull()
    on.onPointerDown()
    expect(probe.tip.bubble).toBeNull()

    // Left before the delay, it never opens.
    on.onPointerEnter(MOUSE)
    vi.advanceTimersByTime(200)
    on.onPointerLeave()
    vi.advanceTimersByTime(400)
    expect(probe.tip.bubble).toBeNull()
  })

  it("opens only the outer of two tips under the pointer", () => {
    const outerBox = new Box(new Box(null, false), true)
    const outer = mount("Outer")
    const inner = mount("Inner")
    spread(outer, outerBox).onPointerEnter(MOUSE)
    spread(inner, new Box(outerBox, true)).onPointerEnter(MOUSE)
    vi.advanceTimersByTime(400)
    expect(outer.tip.bubble).not.toBeNull()
    expect(inner.tip.bubble).toBeNull()
  })
})
