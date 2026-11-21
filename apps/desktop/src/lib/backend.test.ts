// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import {
  BackendError,
  parseAppInfo,
  parseImported,
  parseOpenPage,
  parseProgress,
  parseSnapshot,
  parseUpdate,
  toBackendError,
} from "./backend"

const snapshot = {
  id: 1,
  takenAt: 1_700_000_000_000,
  importedAt: 1_700_000_100_000,
  source: "Teyvat.me",
  uid: 100000001,
  summary: {
    characters: 2,
    weapons: 3,
    artifacts: 4,
    materials: 5,
    mora: 6,
    primogems: null,
    artifacts4: 1,
    artifacts3: null,
    essence: 7,
  },
  hasRaw: true,
  review: false,
  session: null,
  live: false,
}

describe("backend responses", () => {
  it("accepts well-formed app info and rejects anything else", () => {
    const info = {
      version: "0.1.0",
      portable: false,
      updatesEnabled: false,
      updatesInPlace: true,
      capture: true,
      testBuild: false,
    }
    expect(parseAppInfo(info)).toEqual(info)
    expect(() => parseAppInfo({ ...info, capture: undefined })).toThrow(BackendError)
    expect(() => parseAppInfo({ ...info, testBuild: undefined })).toThrow(BackendError)
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
    expect(parseSnapshot({ ...snapshot, uid: null })).toEqual({ ...snapshot, uid: null })
    expect(() => parseSnapshot({ ...snapshot, review: undefined })).toThrow(BackendError)
    expect(() => parseSnapshot({ ...snapshot, uid: "1" })).toThrow(BackendError)
    expect(() => parseSnapshot({ ...snapshot, summary: { characters: 2 } })).toThrow(BackendError)
  })

  it("reads a snapshot's session and a head row's live mark", () => {
    const head = { ...snapshot, id: -7, session: 3, live: true }
    expect(parseSnapshot(head)).toEqual(head)
    expect(() => parseSnapshot({ ...snapshot, session: undefined })).toThrow(BackendError)
    expect(() => parseSnapshot({ ...snapshot, session: "3" })).toThrow(BackendError)
    expect(() => parseSnapshot({ ...snapshot, live: null })).toThrow(BackendError)
  })

  it("reads each import outcome with the file's keys", () => {
    const keys = { characters: ["FakeHero"], weapons: [], artifactSets: [], materials: ["Mora"] }
    const saved = { outcome: { status: "saved", snapshot }, keys }
    expect(parseImported(saved)).toEqual(saved)
    const duplicate = { outcome: { status: "duplicate", takenAt: 5 }, keys }
    expect(parseImported(duplicate)).toEqual(duplicate)
    const warnings = [
      { kind: "fewer", what: "artifacts", before: 10, after: 1 },
      { kind: "newAccount" },
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
    expect(toBackendError({ kind: "notLeyline" }).kind).toBe("notLeyline")
  })

  it("reads a clicked notification's page and the account it carries", () => {
    expect(parseOpenPage("overview@3")).toEqual({ page: "overview", account: 3 })
    expect(parseOpenPage("home")).toEqual({ page: "home" })
    expect(parseOpenPage("overview@x")).toEqual({ page: "overview" })
    expect(parseOpenPage(5)).toBeNull()
  })
})
