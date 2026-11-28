// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * With the modules under lib/backend/, the only ones that talk to the Rust
 * side. Every response is checked at runtime before the rest of the app sees it.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { lang } from "@/i18n"
import {
  call,
  isNullableNumber,
  isNullableString,
  isNumber,
  isRecord,
  isStrings,
  protocolError,
} from "@/lib/backend/shared"

export { BackendError, toBackendError } from "@/lib/backend/shared"

export type AppInfo = {
  version: string
  portable: boolean
  updatesEnabled: boolean
  /** An update is downloaded and put in place on restart, not only announced. */
  updatesInPlace: boolean
  /** A test build: made with its own identifier, so its data stays apart. */
  testBuild: boolean
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
  /** 4★ and 3★ artifacts; null for snapshots imported before these were counted. */
  artifacts4: number | null
  artifacts3: number | null
  /** Sanctifying Essence, null as for Mora. */
  essence: number | null
}
export type Snapshot = {
  id: number
  /** Unix milliseconds: when the data was read, and when it was imported. */
  takenAt: number
  importedAt: number
  source: string
  /** Tells accounts apart; shown unless set to mask it. Null when the file has none. */
  uid: number | null
  summary: Summary
  /** Whether the original export is still kept (the newest 100 of each account are). */
  hasRaw: boolean
  /** Saved by auto sync although it looked wrong next to the one before: keep or delete it. */
  review: boolean
  /** Auto sync's login it belongs to (that login's first snapshot's id); null for imports. */
  session: number | null
  /** A head row standing for the export auto sync holds right now. */
  live: boolean
}

/**
 * A head row: a session's newest batch of changes, listed when it is newer
 * than the session's newest snapshot. While playing it is the live point;
 * after a crash, the last sync. Its id is the batch's, negated.
 */
export const isHead = (snapshot: Snapshot) => snapshot.id < 0

export type ImportWarning =
  | { kind: "fewer"; what: "characters" | "weapons" | "artifacts"; before: number; after: number }
  /** Of an account no snapshot is of yet, while others are; asked for files only. */
  | { kind: "newAccount" }
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

export function parseAppInfo(value: unknown): AppInfo {
  if (
    isRecord(value) &&
    typeof value.version === "string" &&
    typeof value.portable === "boolean" &&
    typeof value.updatesEnabled === "boolean" &&
    typeof value.updatesInPlace === "boolean" &&
    typeof value.testBuild === "boolean"
  ) {
    return {
      version: value.version,
      portable: value.portable,
      updatesEnabled: value.updatesEnabled,
      updatesInPlace: value.updatesInPlace,
      testBuild: value.testBuild,
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
    return { version: value.version, notes: value.notes && notesIn(value.notes) }
  }
  throw protocolError("update info")
}

/**
 * The notes in the UI's language: they carry the Chinese, a rule, then the
 * English, whose items wrap onto indented lines that are joined here.
 */
function notesIn(notes: string) {
  const [zh, en] = notes.split("\n\n---\n\n")
  return ((lang === "en" ? en : zh) ?? notes).replace(/\n[ \t]+/g, " ")
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

function parseSummary(value: unknown): Summary {
  if (
    isRecord(value) &&
    isNumber(value.characters) &&
    isNumber(value.weapons) &&
    isNumber(value.artifacts) &&
    isNumber(value.materials) &&
    isNullableNumber(value.mora) &&
    isNullableNumber(value.primogems) &&
    isNullableNumber(value.artifacts4) &&
    isNullableNumber(value.artifacts3) &&
    isNullableNumber(value.essence)
  ) {
    return {
      characters: value.characters,
      weapons: value.weapons,
      artifacts: value.artifacts,
      materials: value.materials,
      mora: value.mora,
      primogems: value.primogems,
      artifacts4: value.artifacts4,
      artifacts3: value.artifacts3,
      essence: value.essence,
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
    typeof value.source === "string" &&
    isNullableNumber(value.uid) &&
    typeof value.hasRaw === "boolean" &&
    typeof value.review === "boolean" &&
    isNullableNumber(value.session) &&
    typeof value.live === "boolean"
  ) {
    return {
      id: value.id,
      takenAt: value.takenAt,
      importedAt: value.importedAt,
      source: value.source,
      uid: value.uid,
      summary: parseSummary(value.summary),
      hasRaw: value.hasRaw,
      review: value.review,
      session: value.session,
      live: value.live,
    }
  }
  throw protocolError("snapshot")
}

function parseWarning(value: unknown): ImportWarning {
  if (isRecord(value) && value.kind === "newAccount") return { kind: "newAccount" }
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
 * Imports one Leyline file; `modifiedAt` (the file's, in unix milliseconds)
 * stands in when it carries no time of its own. A file that looks wrong next
 * to its account's snapshot before it, or is of an account not saved yet
 * while others are, comes back as "needsConfirmation" until it is sent again
 * with `confirmed`. A file without Leyline data fails as "notLeyline".
 */
export async function importSnapshot(text: string, modifiedAt: number, confirmed: boolean) {
  return parseImported(await call("import_snapshot", { text, modifiedAt, confirmed }))
}

/** Every snapshot, and each session's head row when it has one, newest first. */
export async function listSnapshots() {
  const value = await call("list_snapshots")
  if (!Array.isArray(value)) throw protocolError("snapshot list")
  return value.map(parseSnapshot)
}

/**
 * The original export of a snapshot as JSON, or null once only its summary
 * is kept. A head row's is rebuilt from its session's batches unless it is
 * live; one that does not rebuild exactly fails. Checked field by field in
 * domain/account.
 */
export async function getSnapshotExport(id: number): Promise<unknown> {
  const value = await call("snapshot_export", { id })
  if (value === null) return null
  if (typeof value !== "string") throw protocolError("snapshot export")
  try {
    return JSON.parse(value)
  } catch {
    throw protocolError("snapshot export")
  }
}

/** Clears a snapshot's review mark. */
export async function keepSnapshot(id: number) {
  await call("keep_snapshot", { id })
}

export async function deleteSnapshot(id: number) {
  await call("delete_snapshot", { id })
}

/** Deletes an account's snapshots, timelines, planner and tasks; `null` is no account's. */
export async function deleteAccount(uid: number | null) {
  await call("delete_account", { uid })
}

/** Where the data is; only the installed build can move it. */
export type DataDir = { dir: string; isDefault: boolean; movable: boolean }
/** A folder the data can go to; existing: it already has data of its own, used as it is. */
export type DataDirPlan = { dir: string; existing: boolean }

export async function getDataDir(): Promise<DataDir> {
  const value = await call("data_dir")
  if (
    !isRecord(value) ||
    typeof value.dir !== "string" ||
    typeof value.isDefault !== "boolean" ||
    typeof value.movable !== "boolean"
  ) {
    throw protocolError("data directory")
  }
  return { dir: value.dir, isDefault: value.isDefault, movable: value.movable }
}

/** The default folder, or one the user picks in a dialog; null when they cancel. */
export async function planDataDir(useDefault: boolean): Promise<DataDirPlan | null> {
  const value = await call("plan_data_dir", { default: useDefault })
  if (value === null) return null
  if (!isRecord(value) || typeof value.dir !== "string" || typeof value.existing !== "boolean") {
    throw protocolError("data directory plan")
  }
  return { dir: value.dir, existing: value.existing }
}

/** Restarts the app, which moves the data to `dir` (from a plan) before it opens. */
export async function moveDataDir(dir: string) {
  await call("move_data_dir", { dir })
}

export async function openDataDir() {
  await call("open_data_dir")
}

export async function openLogDir() {
  await call("open_log_dir")
}

/** The project's page in the default browser; its address is fixed on the Rust side. */
export async function openHomepage() {
  await call("open_homepage")
}

/** The QQ group's invite page; its address is fixed on the Rust side. */
export async function openGroupChat() {
  await call("open_group_chat")
}

/** A video search for `keyword`, Bilibili's or in English YouTube's; fixed on the Rust side. */
export async function openVideoSearch(keyword: string) {
  await call("open_video_search", { keyword })
}

/** The Bilibili page the anecdotes guide comes from; its address is fixed on the Rust side. */
export async function openTravelersTales() {
  await call("open_travelers_tales")
}

/** The account's planner as saved, parsed but not checked; null before the first save. */
export async function getPlannerData(uid: number): Promise<unknown> {
  const value = await call("planner_data", { uid })
  if (value === null) return null
  if (typeof value !== "string") throw protocolError("planner data")
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw protocolError("planner data")
  }
}

export async function savePlannerData(uid: number, data: unknown) {
  await call("save_planner_data", { uid, data: JSON.stringify(data) })
}

/** The account's tasks as saved, unparsed; null before the first save. */
export async function getTasksData(uid: number): Promise<string | null> {
  const value = await call("tasks_data", { uid })
  if (isNullableString(value)) return value
  throw protocolError("tasks data")
}

export async function saveTasksData(uid: number, data: unknown) {
  await call("save_tasks_data", { uid, data: JSON.stringify(data) })
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

/** Tells the Rust side the page's language, for the tray and its own dialogs. */
export async function setLanguage(english: boolean) {
  await call("set_language", { english })
}

/** Tells the Rust side whether closing the window quits the app or keeps it in the tray. */
export async function setCloseQuits(quits: boolean) {
  await call("set_close_quits", { quits })
}

/**
 * Shows a Windows notification; a click on it opens the app at `page`, on
 * `account` (a token) when given. Rust hands the page back as it got it, so
 * the token rides in it as `page@token`.
 */
export async function showNotification(
  title: string,
  body: string,
  page: string,
  account?: number,
) {
  await call("notify", { title, body, page: account === undefined ? page : `${page}@${account}` })
}

/** What a clicked notification is about: its page, and its account's token if it has one. */
export function parseOpenPage(payload: unknown): { page: string; account?: number } | null {
  if (typeof payload !== "string") return null
  const [page = "", token] = payload.split("@")
  const account = Number(token)
  return Number.isSafeInteger(account) && account > 0 ? { page, account } : { page }
}

/** A notification was clicked: the page it is about, and the account if it is about one. */
export function onOpenPage(handler: (page: string, account?: number) => void): Promise<UnlistenFn> {
  return listen<unknown>("open-page", event => {
    const target = parseOpenPage(event.payload)
    if (target) handler(target.page, target.account)
  })
}

/** The window was closed, which only hides it: the app stays in the tray. */
export function onHiddenToTray(handler: () => void): Promise<UnlistenFn> {
  return listen("hidden-to-tray", () => handler())
}

export function onUpdateProgress(handler: (progress: UpdateProgress) => void): Promise<UnlistenFn> {
  return listen<unknown>("update-progress", event => {
    const progress = parseProgress(event.payload)
    if (progress) handler(progress)
  })
}
