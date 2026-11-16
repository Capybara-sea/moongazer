// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import {
  BackendError,
  parseAppInfo,
  parseImported,
  parseProgress,
  parseSnapshot,
  parseUpdate,
  toBackendError,
} from "./backend"

const snapshot = {
  id: 1,
  takenAt: 1_700_000_000_000,
  importedAt: 1_700_000_100_000,
  format: "leyline",
  source: "Teyvat.me",
  summary: { characters: 2, weapons: 3, artifacts: 4, materials: 5, mora: 6, primogems: null },
  hasRaw: true,
}

describe("backend responses", () => {
  it("accepts well-formed app info and rejects anything else", () => {
    const info = { version: "0.1.0", portable: false, updatesEnabled: false, updatesInPlace: true }
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

  it("checks snapshots down to their summary", () => {
    expect(parseSnapshot(snapshot)).toEqual(snapshot)
    expect(() => parseSnapshot({ ...snapshot, format: "csv" })).toThrow(BackendError)
    expect(() => parseSnapshot({ ...snapshot, summary: { characters: 2 } })).toThrow(BackendError)
  })

  it("reads each import outcome with the file's keys", () => {
    const keys = { characters: ["FakeHero"], weapons: [], artifactSets: [], materials: ["Mora"] }
    const saved = { outcome: { status: "saved", snapshot }, keys }
    expect(parseImported(saved)).toEqual(saved)
    const duplicate = { outcome: { status: "duplicate", takenAt: 5 }, keys }
    expect(parseImported(duplicate)).toEqual(duplicate)
    const warnings = [
      { kind: "fewer", what: "artifacts", before: 10, after: 1 },
      { kind: "otherAccount" },
    ]
    const confirm = { outcome: { status: "needsConfirmation", warnings }, keys }
    expect(parseImported(confirm)).toEqual(confirm)
    expect(() => parseImported({ outcome: { status: "saved" }, keys })).toThrow(BackendError)
    expect(() => parseImported({ ...saved, keys: { characters: [1] } })).toThrow(BackendError)
  })

  it("maps Rust command errors to their kind", () => {
    const pending = toBackendError({ kind: "nothingPending" })
    expect([pending.kind, pending.message]).toEqual(["nothingPending", "nothingPending"])
    const check = toBackendError({ kind: "check", message: "timed out" })
    expect([check.kind, check.message]).toEqual(["check", "timed out"])
    expect(toBackendError(new Error("boom")).kind).toBe("unknown")
    expect(toBackendError("plain").message).toBe("plain")
    expect(toBackendError({ kind: "unsupportedVersion", message: 4 }).message).toBe("4")
  })
})
