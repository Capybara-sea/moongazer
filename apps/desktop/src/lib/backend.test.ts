// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { BackendError, parseAppInfo, parseProgress, parseUpdate, toBackendError } from "./backend"

describe("backend responses", () => {
  it("accepts well-formed app info and rejects anything else", () => {
    const info = { version: "0.1.0", portable: false, updatesEnabled: false }
    expect(parseAppInfo(info)).toEqual(info)
    expect(() => parseAppInfo({ version: "0.1.0" })).toThrow(BackendError)
    expect(() => parseAppInfo(null)).toThrow(BackendError)
  })

  it("treats null as no update", () => {
    expect(parseUpdate(null)).toBeNull()
    expect(parseUpdate({ version: "0.2.0", notes: null })).toEqual({
      version: "0.2.0",
      notes: null,
    })
    expect(() => parseUpdate({ version: 2 })).toThrow(BackendError)
  })

  it("drops malformed progress events instead of throwing", () => {
    expect(parseProgress({ downloaded: 10, total: null })).toEqual({ downloaded: 10, total: null })
    expect(parseProgress({ downloaded: "10" })).toBeNull()
  })

  it("maps Rust command errors to their kind", () => {
    const pending = toBackendError({ kind: "nothingPending" })
    expect([pending.kind, pending.message]).toEqual(["nothingPending", "nothingPending"])
    const check = toBackendError({ kind: "check", message: "timed out" })
    expect([check.kind, check.message]).toEqual(["check", "timed out"])
    expect(toBackendError(new Error("boom")).kind).toBe("unknown")
    expect(toBackendError("plain").message).toBe("plain")
  })
})
