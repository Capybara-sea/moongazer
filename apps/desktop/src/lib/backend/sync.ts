// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Auto sync's part of the backend. Its commands exist only in builds with
 * AppInfo.capture, except session_timeline, which every build has.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { parseSnapshot, type Snapshot } from "@/lib/backend"
import {
  call,
  isNullableNumber,
  isNullableString,
  isNumber,
  isOneOf,
  isRecord,
  isStrings,
  protocolError,
} from "./shared"

const CAPTURE_PHASES = [
  "off",
  "starting",
  "waitingGame",
  "waitingLogin",
  "connected",
  "interrupted",
] as const
export type CapturePhase = (typeof CAPTURE_PHASES)[number]
const HELPER_STATES = ["off", "starting", "running", "retrying", "exited"] as const
/** The capture mode, the panel's first step. */
export type HelperState = (typeof HELPER_STATES)[number]
export type Server = "china" | "global"
const PROBLEM_KINDS = [
  "declined",
  "launchFailed",
  "packUnavailable",
  "helperExited",
  "decoderStopped",
  "captureFailed",
  "alreadyInGame",
  "keyLost",
  "packOutdated",
  "switchedToCompatible",
  "updateFailed",
] as const
export type CaptureProblem =
  | { kind: (typeof PROBLEM_KINDS)[number] }
  /** `leftOut` counts what the game data does not know, e.g. "unknown_weapon: 2". */
  | { kind: "dataOutdated"; leftOut: string }
export type CaptureAccount = {
  nickname: string | null
  uid: number | null
  adventureRank: number | null
}
export type CaptureStatus = {
  phase: CapturePhase
  helper: HelperState
  /** The game client running; while interrupted, the one from before. Null while none is. */
  server: Server | null
  /** The login's session key is held: the player is in Teyvat. */
  entered: boolean
  /** Set once a login settled. */
  account: CaptureAccount | null
  /** Unix ms: when the login came, and when reading stopped. */
  loginAt: number | null
  lostAt: number | null
  /** The login's first snapshot was saved. */
  settled: boolean
  /** Unix ms of the last snapshot auto sync saved. */
  savedAt: number | null
  compatible: boolean
  problem: CaptureProblem | null
}
/**
 * One change, by its path of GOOD keys from the export's root: characters by
 * key, weapons and artifacts by gi_guid, e.g. ["materials", "Mora"] or
 * ["weapons", "<gi_guid>", "level"]. `before` is null for a path added,
 * `after` for one removed; a value that was null reads the same. `key` is the
 * weapon's key or the artifact's set for a change under one of those items.
 */
export type Changed = { path: string[]; before: unknown; after: unknown; key: string | null }
/**
 * What changed since the batch before (or the login's first snapshot), read
 * at `at` (unix ms). Batches come at most every 15 s, only when not empty.
 */
export type Batch = { at: number; changes: Changed[] }
/** A stored batch of a session, by its id. */
export type TimelineBatch = Batch & { id: number }
export type SyncSettings = { autoStart: boolean }

function parseProblem(value: unknown): CaptureProblem | null {
  if (value === null) return null
  if (isRecord(value)) {
    if (value.kind === "dataOutdated" && typeof value.leftOut === "string") {
      return { kind: "dataOutdated", leftOut: value.leftOut }
    }
    if (isOneOf(PROBLEM_KINDS, value.kind)) return { kind: value.kind }
  }
  throw protocolError("sync problem")
}

function parseCaptureAccount(value: unknown): CaptureAccount | null {
  if (value === null) return null
  if (
    isRecord(value) &&
    isNullableString(value.nickname) &&
    isNullableNumber(value.uid) &&
    isNullableNumber(value.adventureRank)
  ) {
    return { nickname: value.nickname, uid: value.uid, adventureRank: value.adventureRank }
  }
  throw protocolError("sync account")
}

export function parseCaptureStatus(value: unknown): CaptureStatus {
  if (
    isRecord(value) &&
    isOneOf(CAPTURE_PHASES, value.phase) &&
    isOneOf(HELPER_STATES, value.helper) &&
    (value.server === null || value.server === "china" || value.server === "global") &&
    typeof value.entered === "boolean" &&
    isNullableNumber(value.loginAt) &&
    isNullableNumber(value.lostAt) &&
    typeof value.settled === "boolean" &&
    isNullableNumber(value.savedAt) &&
    typeof value.compatible === "boolean"
  ) {
    return {
      phase: value.phase,
      helper: value.helper,
      server: value.server,
      entered: value.entered,
      account: parseCaptureAccount(value.account),
      loginAt: value.loginAt,
      lostAt: value.lostAt,
      settled: value.settled,
      savedAt: value.savedAt,
      compatible: value.compatible,
      problem: parseProblem(value.problem),
    }
  }
  throw protocolError("sync status")
}

/**
 * Changes as sent, `{ p, b?, a?, k? }`. The values are GOOD's, checked where
 * they are read.
 */
export function parseChanges(value: unknown): Changed[] {
  if (!Array.isArray(value)) throw protocolError("sync changes")
  return value.map(item => {
    if (isRecord(item) && isStrings(item.p) && (item.k === undefined || isNullableString(item.k))) {
      return { path: item.p, before: item.b ?? null, after: item.a ?? null, key: item.k ?? null }
    }
    throw protocolError("sync change")
  })
}

export function parseBatch(value: unknown): Batch {
  if (isRecord(value) && isNumber(value.at)) {
    return { at: value.at, changes: parseChanges(value.changes) }
  }
  throw protocolError("sync batch")
}

export function parseBatches(value: unknown): Batch[] {
  if (!Array.isArray(value)) throw protocolError("sync batches")
  return value.map(parseBatch)
}

export function parseTimeline(value: unknown): TimelineBatch[] {
  if (!Array.isArray(value)) throw protocolError("session timeline")
  return value.map(item => {
    if (isRecord(item) && isNumber(item.id)) return { id: item.id, ...parseBatch(item) }
    throw protocolError("timeline batch")
  })
}

export function parseSyncSettings(value: unknown): SyncSettings {
  if (isRecord(value) && typeof value.autoStart === "boolean") return { autoStart: value.autoStart }
  throw protocolError("sync settings")
}

export async function getCaptureStatus() {
  return parseCaptureStatus(await call("capture_status"))
}

/** Every batch since the login, oldest first. */
export async function getCaptureChanges() {
  return parseBatches(await call("capture_changes"))
}

/**
 * Every stored batch of one session, oldest first. Batches are kept for good,
 * so this outlives the session's exports.
 */
export async function getSessionTimeline(session: number) {
  const value = await call("session_timeline", { session })
  if (typeof value !== "string") throw protocolError("session timeline")
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw protocolError("session timeline")
  }
  return parseTimeline(parsed)
}

/** Asks for elevation and starts the sync helper; status events follow. */
export async function startCapture() {
  await call("capture_start")
}

export async function stopCapture() {
  await call("capture_stop")
}

/** Saves a snapshot now; "snapshots-changed" follows. */
export async function saveCaptureNow() {
  await call("capture_save_now")
}

export async function getSyncSettings() {
  return parseSyncSettings(await call("sync_settings"))
}

export async function setSyncAutoStart(on: boolean) {
  await call("set_sync_auto_start", { on })
}

/** Auto sync's status changed. A malformed one is dropped; the next replaces it anyway. */
export function onCaptureStatus(handler: (status: CaptureStatus) => void): Promise<UnlistenFn> {
  return listen<unknown>("capture-status", event => {
    let status: CaptureStatus
    try {
      status = parseCaptureStatus(event.payload)
    } catch {
      return
    }
    handler(status)
  })
}

/** One more batch since the login. A malformed one is dropped. */
export function onCaptureChange(handler: (batch: Batch) => void): Promise<UnlistenFn> {
  return listen<unknown>("capture-change", event => {
    let batch: Batch
    try {
      batch = parseBatch(event.payload)
    } catch {
      return
    }
    handler(batch)
  })
}

/** The batches since the login are gone: a new login, or sync stopped or started. */
export function onCaptureChangesCleared(handler: () => void): Promise<UnlistenFn> {
  return listen("capture-changes-cleared", () => handler())
}

/** Auto sync saved a snapshot: the history is to be read again. */
export function onSnapshotsChanged(handler: () => void): Promise<UnlistenFn> {
  return listen("snapshots-changed", () => handler())
}

/**
 * Auto sync stored a batch: its session's head row, in place of the one
 * before. A malformed one is dropped; the next replaces it anyway.
 */
export function onSnapshotHead(handler: (head: Snapshot) => void): Promise<UnlistenFn> {
  return listen<unknown>("snapshot-head", event => {
    let head: Snapshot
    try {
      head = parseSnapshot(event.payload)
    } catch {
      return
    }
    handler(head)
  })
}
