// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it, vi } from "vitest"

// The module reads the hash and listens for changes when loaded; tests run without a window.
vi.stubGlobal("location", { hash: "" })
vi.stubGlobal("addEventListener", () => {})
const { parseRoute } = await import("./route")

describe("parseRoute", () => {
  it("reads the page and what it shows", () => {
    expect(parseRoute("#/overview")).toEqual({ page: "overview" })
    expect(parseRoute("#/characters/FakeHero")).toEqual({ page: "characters", param: "FakeHero" })
    expect(parseRoute("#/characters/Caf%C3%A9")).toEqual({ page: "characters", param: "Café" })
  })

  it("falls back to home, and to the page itself on a bad escape", () => {
    expect(parseRoute("")).toEqual({ page: "home" })
    expect(parseRoute("#/nowhere")).toEqual({ page: "home" })
    expect(parseRoute("#/characters/%E6")).toEqual({ page: "characters" })
  })
})
