// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import type { Snapshot } from "@/lib/backend"
import { entryAccount, previousSnapshot } from "./accountStore"

function snapshot(id: number, format: Snapshot["format"], hasRaw = true): Snapshot {
  return {
    id,
    takenAt: id * 1000,
    importedAt: id * 1000,
    format,
    source: "Fake",
    summary: {
      characters: 0,
      weapons: 0,
      artifacts: 0,
      materials: 0,
      mora: null,
      primogems: null,
      artifacts4: null,
      artifacts3: null,
      essence: null,
    },
    hasRaw,
  }
}

describe("previousSnapshot", () => {
  const good = snapshot(4, "good")
  const leyline = snapshot(3, "leyline")
  const oldGood = snapshot(2, "good")
  const oldLeyline = snapshot(1, "leyline")

  it("takes the newest older Leyline export over GOOD files in between", () => {
    expect(previousSnapshot([good, leyline, oldGood], undefined)).toBe(leyline)
  })

  it("looks past the Leyline snapshot standing in for the one shown", () => {
    expect(previousSnapshot([leyline, oldGood, oldLeyline], leyline)).toBe(oldLeyline)
  })

  it("falls back to the newest older export when no Leyline one is kept", () => {
    expect(previousSnapshot([good, snapshot(3, "leyline", false), oldGood], undefined)).toBe(good)
    expect(previousSnapshot([snapshot(5, "good", false)], undefined)).toBeUndefined()
    expect(previousSnapshot([], undefined)).toBeUndefined()
  })
})

describe("entryAccount", () => {
  const account: Account = {
    leyline: false,
    characters: [],
    weapons: [],
    artifacts: [],
    materials: new Map(),
    characterInfo: new Map(),
  }

  it("has no account when there is no snapshot", () => {
    expect(entryAccount(false, undefined)).toBeNull()
  })

  it("waits while the export is read", () => {
    expect(entryAccount(true, undefined)).toBeUndefined()
    expect(entryAccount(true, { status: "loading" })).toBeUndefined()
  })

  it("gives the account once read, even an empty one", () => {
    expect(entryAccount(true, { status: "ready", account })).toBe(account)
  })

  it("has no account when the export cannot be read", () => {
    expect(entryAccount(true, { status: "failed", message: "fake failure" })).toBeNull()
    expect(entryAccount(true, { status: "summaryOnly" })).toBeNull()
  })
})
