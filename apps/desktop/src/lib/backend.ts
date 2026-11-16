// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The only module that talks to the Rust side. Every response is checked at
 * runtime before the rest of the app sees it.
 */

import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"

export type AppInfo = {
  version: string
  portable: boolean
  updatesEnabled: boolean
  /** An update is downloaded and put in place on restart, not only announced. */
  updatesInPlace: boolean
}
export type UpdateInfo = { version: string; notes: string | null }
export type UpdateProgress = { downloaded: number; total: number | null }

export type Summary = {
  characters: number
  weapons: number
  artifacts: number
  materials: number
  /** null when the file had no materials at all. */
  mora: number | null
  primogems: number | null
}
export type Snapshot = {
  id: number
  /** Unix milliseconds: when the data was read, and when it was imported. */
  takenAt: number
  importedAt: number
  format: "good" | "leyline"
  source: string
  summary: Summary
  /** Whether the original export is still kept (the newest 100 are). */
  hasRaw: boolean
}
export type ImportWarning =
  | { kind: "fewer"; what: "characters" | "weapons" | "artifacts"; before: number; after: number }
  | { kind: "otherAccount" }
export type ImportOutcome =
  | { status: "saved"; snapshot: Snapshot }
  | { status: "duplicate"; takenAt: number }
  | { status: "needsConfirmation"; warnings: ImportWarning[] }
export type ImportKeys = {
  characters: string[]
  weapons: string[]
  artifactSets: string[]
  materials: string[]
}
export type Imported = { outcome: ImportOutcome; keys: ImportKeys }

export class BackendError extends Error {
  readonly kind: string

  constructor(kind: string, message: string) {
    super(message)
    this.name = "BackendError"
    this.kind = kind
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function protocolError(what: string) {
  return new BackendError("protocol", `unexpected ${what} from the backend`)
}

export function parseAppInfo(value: unknown): AppInfo {
  if (
    isRecord(value) &&
    typeof value.version === "string" &&
    typeof value.portable === "boolean" &&
    typeof value.updatesEnabled === "boolean" &&
    typeof value.updatesInPlace === "boolean"
  ) {
    return {
      version: value.version,
      portable: value.portable,
      updatesEnabled: value.updatesEnabled,
      updatesInPlace: value.updatesInPlace,
    }
  }
  throw protocolError("app info")
}

export function parseUpdate(value: unknown): UpdateInfo | null {
  if (value === null) return null
  if (
    isRecord(value) &&
    typeof value.version === "string" &&
    (value.notes === null || typeof value.notes === "string")
  ) {
    return { version: value.version, notes: value.notes }
  }
  throw protocolError("update info")
}

export function parseProgress(value: unknown): UpdateProgress | null {
  if (
    isRecord(value) &&
    typeof value.downloaded === "number" &&
    (value.total === null || typeof value.total === "number")
  ) {
    return { downloaded: value.downloaded, total: value.total }
  }
  return null
}

const isNumber = (value: unknown): value is number => typeof value === "number"
const isNullableNumber = (value: unknown): value is number | null =>
  value === null || typeof value === "number"
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string")

function parseSummary(value: unknown): Summary {
  if (
    isRecord(value) &&
    isNumber(value.characters) &&
    isNumber(value.weapons) &&
    isNumber(value.artifacts) &&
    isNumber(value.materials) &&
    isNullableNumber(value.mora) &&
    isNullableNumber(value.primogems)
  ) {
    return {
      characters: value.characters,
      weapons: value.weapons,
      artifacts: value.artifacts,
      materials: value.materials,
      mora: value.mora,
      primogems: value.primogems,
    }
  }
  throw protocolError("snapshot summary")
}

export function parseSnapshot(value: unknown): Snapshot {
  if (
    isRecord(value) &&
    isNumber(value.id) &&
    isNumber(value.takenAt) &&
    isNumber(value.importedAt) &&
    (value.format === "good" || value.format === "leyline") &&
    typeof value.source === "string" &&
    typeof value.hasRaw === "boolean"
  ) {
    return {
      id: value.id,
      takenAt: value.takenAt,
      importedAt: value.importedAt,
      format: value.format,
      source: value.source,
      summary: parseSummary(value.summary),
      hasRaw: value.hasRaw,
    }
  }
  throw protocolError("snapshot")
}

function parseWarning(value: unknown): ImportWarning {
  if (isRecord(value) && value.kind === "otherAccount") return { kind: "otherAccount" }
  if (
    isRecord(value) &&
    value.kind === "fewer" &&
    (value.what === "characters" || value.what === "weapons" || value.what === "artifacts") &&
    isNumber(value.before) &&
    isNumber(value.after)
  ) {
    return {
      kind: "fewer",
      what: value.what,
      before: value.before,
      after: value.after,
    }
  }
  throw protocolError("import warning")
}

function parseOutcome(value: unknown): ImportOutcome {
  if (isRecord(value)) {
    if (value.status === "saved")
      return { status: "saved", snapshot: parseSnapshot(value.snapshot) }
    if (value.status === "duplicate" && isNumber(value.takenAt)) {
      return { status: "duplicate", takenAt: value.takenAt }
    }
    if (value.status === "needsConfirmation" && Array.isArray(value.warnings)) {
      return { status: "needsConfirmation", warnings: value.warnings.map(parseWarning) }
    }
  }
  throw protocolError("import outcome")
}

export function parseImported(value: unknown): Imported {
  const keys = isRecord(value) ? value.keys : undefined
  if (
    isRecord(value) &&
    isRecord(keys) &&
    isStrings(keys.characters) &&
    isStrings(keys.weapons) &&
    isStrings(keys.artifactSets) &&
    isStrings(keys.materials)
  ) {
    return {
      outcome: parseOutcome(value.outcome),
      keys: {
        characters: keys.characters,
        weapons: keys.weapons,
        artifactSets: keys.artifactSets,
        materials: keys.materials,
      },
    }
  }
  throw protocolError("import result")
}

/** Rust command errors arrive as `{ kind, message? }`. */
export function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error
  if (isRecord(error) && typeof error.kind === "string") {
    const message =
      typeof error.message === "string" || typeof error.message === "number"
        ? String(error.message)
        : error.kind
    return new BackendError(error.kind, message)
  }
  if (error instanceof Error) return new BackendError("unknown", error.message)
  return new BackendError("unknown", String(error))
}

async function call(command: string, args?: Record<string, unknown>): Promise<unknown> {
  try {
    return await invoke<unknown>(command, args)
  } catch (error) {
    throw toBackendError(error)
  }
}

export async function getAppInfo() {
  return parseAppInfo(await call("app_info"))
}

export async function checkUpdate() {
  return parseUpdate(await call("check_update"))
}

export async function downloadUpdate() {
  await call("download_update")
}

export async function installUpdate() {
  await call("install_update")
}

/**
 * Imports one GOOD or Leyline file. GOOD files carry no time of their own,
 * so `modifiedAt` (the file's, in unix milliseconds) stands in. A file that
 * looks wrong next to the snapshot before it comes back as
 * "needsConfirmation" until it is sent again with `confirmed`.
 */
export async function importSnapshot(text: string, modifiedAt: number, confirmed: boolean) {
  return parseImported(await call("import_snapshot", { text, modifiedAt, confirmed }))
}

/** Every snapshot, newest first. */
export async function listSnapshots() {
  const value = await call("list_snapshots")
  if (!Array.isArray(value)) throw protocolError("snapshot list")
  return value.map(parseSnapshot)
}

export async function getDataDir() {
  const value = await call("data_dir")
  if (typeof value !== "string") throw protocolError("data directory")
  return value
}

export async function openDataDir() {
  await call("open_data_dir")
}

/**
 * Best effort: outside the Tauri window (a plain browser on the dev server)
 * `getCurrentWindow` throws synchronously, and the title is not worth a crash.
 */
export async function setWindowTitle(title: string) {
  try {
    await getCurrentWindow().setTitle(title)
  } catch {
    // The ASCII title from tauri.conf.json stays.
  }
}

export function onUpdateProgress(handler: (progress: UpdateProgress) => void): Promise<UnlistenFn> {
  return listen<unknown>("update-progress", event => {
    const progress = parseProgress(event.payload)
    if (progress) handler(progress)
  })
}
