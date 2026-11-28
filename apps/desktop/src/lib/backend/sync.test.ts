// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { BackendError } from "./shared"
import {
  parseBatch,
  parseBatches,
  parseCaptureStatus,
  parseChanges,
  parseSyncSettings,
  parseTimeline,
} from "./sync"

const status = {
  phase: "connected",
  helper: "running",
  server: "china",
  entered: true,
  account: { nickname: "Fake", uid: 100000001, adventureRank: 60 },
  loginAt: 1_700_000_000_000,
  lostAt: null,
  settled: true,
  savedAt: 1_700_000_060_000,
  compatible: false,
  problem: null,
}

describe("auto sync responses", () => {
  it("checks the sync status down to its account and problem", () => {
    expect(parseCaptureStatus(status)).toEqual(status)
    const off = { ...status, phase: "off", account: null, server: null, loginAt: null }
    expect(parseCaptureStatus(off)).toEqual(off)
    const outdated = { ...status, problem: { kind: "dataOutdated", leftOut: "unknown_weapon: 2" } }
    expect(parseCaptureStatus(outdated)).toEqual(outdated)
    const lost = { ...status, problem: { kind: "keyLost" } }
    expect(parseCaptureStatus(lost)).toEqual(lost)
    const updateFailed = { ...off, problem: { kind: "updateFailed" } }
    expect(parseCaptureStatus(updateFailed)).toEqual(updateFailed)
    expect(() => parseCaptureStatus({ ...status, phase: "paused" })).toThrow(BackendError)
    expect(() => parseCaptureStatus({ ...status, server: "eu" })).toThrow(BackendError)
    expect(() => parseCaptureStatus({ ...status, problem: { kind: "other" } })).toThrow(
      BackendError,
    )
    expect(() => parseCaptureStatus({ ...status, problem: { kind: "dataOutdated" } })).toThrow(
      BackendError,
    )
    expect(() => parseCaptureStatus({ ...status, account: { uid: "1" } })).toThrow(BackendError)
  })

  it("reads sync changes with any GOOD values, an absent value as null", () => {
    const blade = { key: "FakeBlade", level: 1 }
    expect(
      parseChanges([
        { p: ["materials", "Mora"], b: 1, a: 2 },
        { p: ["weapons", "7"], a: blade },
        { p: ["weapons", "8"], b: blade },
        { p: ["weapons", "9", "level"], b: 1, a: 20, k: "FakeBlade" },
        { p: ["gi_player", "fake"], b: null, a: 0 },
      ]),
    ).toEqual([
      { path: ["materials", "Mora"], before: 1, after: 2, key: null },
      { path: ["weapons", "7"], before: null, after: blade, key: null },
      { path: ["weapons", "8"], before: blade, after: null, key: null },
      { path: ["weapons", "9", "level"], before: 1, after: 20, key: "FakeBlade" },
      { path: ["gi_player", "fake"], before: null, after: 0, key: null },
    ])
    expect(parseChanges([])).toEqual([])
  })

  it("rejects malformed changes", () => {
    expect(() => parseChanges([{ p: ["materials", 1], b: 1, a: 2 }])).toThrow(BackendError)
    expect(() => parseChanges([{ path: ["materials", "Mora"], before: 1, after: 2 }])).toThrow(
      BackendError,
    )
    expect(() => parseChanges([{ p: ["weapons", "9", "level"], k: 5 }])).toThrow(BackendError)
    expect(() => parseChanges({})).toThrow(BackendError)
  })

  it("reads batches of changes with the time they were read", () => {
    const wire = { at: 1_700_000_015_000, changes: [{ p: ["materials", "Mora"], b: 1, a: 2 }] }
    const batch = {
      at: 1_700_000_015_000,
      changes: [{ path: ["materials", "Mora"], before: 1, after: 2, key: null }],
    }
    expect(parseBatch(wire)).toEqual(batch)
    expect(parseBatches([wire, { at: 1, changes: [] }])).toEqual([batch, { at: 1, changes: [] }])
    expect(parseBatches([])).toEqual([])
    expect(() => parseBatch({ at: "now", changes: [] })).toThrow(BackendError)
    expect(() => parseBatch({ at: 1 })).toThrow(BackendError)
    expect(() => parseBatches(wire)).toThrow(BackendError)
  })

  it("reads a session's timeline with each batch's id", () => {
    const timeline = [
      { id: 4, at: 10, changes: [{ p: ["materials", "Mora"], b: 1, a: 2 }] },
      { id: 9, at: 20, changes: [] },
    ]
    expect(parseTimeline(timeline)).toEqual([
      { id: 4, at: 10, changes: [{ path: ["materials", "Mora"], before: 1, after: 2, key: null }] },
      { id: 9, at: 20, changes: [] },
    ])
    expect(parseTimeline([])).toEqual([])
    expect(() => parseTimeline([{ at: 10, changes: [] }])).toThrow(BackendError)
    expect(() => parseTimeline({ id: 4, at: 10, changes: [] })).toThrow(BackendError)
  })

  it("reads the sync settings", () => {
    expect(parseSyncSettings({ autoStart: false, wishAutoRead: true })).toEqual({
      autoStart: false,
      wishAutoRead: true,
    })
    expect(() => parseSyncSettings({ autoStart: "yes" })).toThrow(BackendError)
  })
})
