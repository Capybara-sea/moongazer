// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { afterEach, describe, expect, it, vi } from "vitest"
import { revealFrom } from "./motion"

const button = { left: 20, top: 30, width: 40, height: 20 }

function stubPage(options: { transitions: boolean; reducedMotion: boolean; switchOff?: boolean }) {
  const vars = new Map<string, string>()
  const start = vi.fn()
  vi.stubGlobal("matchMedia", () => ({ matches: options.reducedMotion }))
  vi.stubGlobal("innerWidth", 340)
  vi.stubGlobal("innerHeight", 440)
  vi.stubGlobal("document", {
    startViewTransition: options.transitions ? start : undefined,
    documentElement: {
      dataset: options.switchOff ? { reduceMotion: "true" } : {},
      style: { setProperty: (k: string, v: string) => vars.set(k, v) },
    },
  })
  return { vars, start }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("revealFrom", () => {
  it("runs the update at once without view transitions or with motion off", () => {
    for (const options of [
      { transitions: false, reducedMotion: false },
      { transitions: true, reducedMotion: true },
      { transitions: true, reducedMotion: false, switchOff: true },
    ]) {
      const { start } = stubPage(options)
      const update = vi.fn()
      revealFrom(button, update)
      expect(update).toHaveBeenCalledOnce()
      expect(start).not.toHaveBeenCalled()
    }
  })

  it("starts the transition from the button's centre out to the farthest corner", () => {
    const { vars, start } = stubPage({ transitions: true, reducedMotion: false })
    const update = vi.fn()
    revealFrom(button, update)
    expect(Object.fromEntries(vars)).toEqual({
      "--reveal-x": "40px",
      "--reveal-y": "40px",
      "--reveal-r": "500px",
    })
    expect(start).toHaveBeenCalledWith({ update, types: ["reveal"] })
    expect(update).not.toHaveBeenCalled()
  })
})
