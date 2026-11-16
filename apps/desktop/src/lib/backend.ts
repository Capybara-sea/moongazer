// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The only module that talks to the Rust side. Every response is checked at
 * runtime before the rest of the app sees it.
 */

import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"

export type AppInfo = { version: string; portable: boolean; updatesEnabled: boolean }
export type UpdateInfo = { version: string; notes: string | null }
export type UpdateProgress = { downloaded: number; total: number | null }

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
    typeof value.updatesEnabled === "boolean"
  ) {
    return {
      version: value.version,
      portable: value.portable,
      updatesEnabled: value.updatesEnabled,
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

/** Rust command errors arrive as `{ kind, message? }`. */
export function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error
  if (isRecord(error) && typeof error.kind === "string") {
    const message = typeof error.message === "string" ? error.message : error.kind
    return new BackendError(error.kind, message)
  }
  if (error instanceof Error) return new BackendError("unknown", error.message)
  return new BackendError("unknown", String(error))
}

async function call(command: string): Promise<unknown> {
  try {
    return await invoke<unknown>(command)
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
