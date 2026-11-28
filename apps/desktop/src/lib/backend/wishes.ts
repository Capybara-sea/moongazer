// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** The wish history's commands and events. */

import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import type { WishRecord } from "@/domain/wishes"
import { call, isNullableNumber, isNumber, isRecord, protocolError } from "@/lib/backend/shared"

export type StoredWishes = { records: WishRecord[]; readAt: number | null }
export type FileAccount = { uid: number; records: number }
export type WishImport = {
  uid: number
  added: number
  known: number
  unknownItems: number
  skipped: number
  gap: boolean
}
export type WishProgress = {
  uid: number
  banners: { banner: number; added: number; done: boolean }[]
}
export type WishReadEnd = {
  uid: number
  added: [number, number][]
  error: "expired" | "busy" | "failed" | "otherAccount" | "stopped" | null
}

export function parseStoredWishes(text: unknown): StoredWishes {
  if (typeof text !== "string") throw protocolError("wish records")
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw protocolError("wish records")
  }
  if (!isRecord(value) || !Array.isArray(value.records) || !isNullableNumber(value.readAt)) {
    throw protocolError("wish records")
  }
  const records = value.records.map(row => {
    if (!Array.isArray(row)) throw protocolError("wish record")
    const [id, gachaType, itemId, rank, time, name] = row
    if (
      typeof id !== "string" ||
      !isNumber(gachaType) ||
      !isNumber(itemId) ||
      !isNumber(rank) ||
      !isNumber(time) ||
      typeof name !== "string"
    ) {
      throw protocolError("wish record")
    }
    return { id, gachaType, itemId, rank, time, name }
  })
  return { records, readAt: value.readAt }
}

function parseFileAccounts(value: unknown): FileAccount[] {
  if (!Array.isArray(value)) throw protocolError("wish file")
  return value.map(item => {
    if (isRecord(item) && isNumber(item.uid) && isNumber(item.records)) {
      return { uid: item.uid, records: item.records }
    }
    throw protocolError("wish file")
  })
}

function parseImports(value: unknown): WishImport[] {
  if (!Array.isArray(value)) throw protocolError("wish import")
  return value.map(item => {
    if (
      isRecord(item) &&
      isNumber(item.uid) &&
      isNumber(item.added) &&
      isNumber(item.known) &&
      isNumber(item.unknownItems) &&
      isNumber(item.skipped) &&
      typeof item.gap === "boolean"
    ) {
      return {
        uid: item.uid,
        added: item.added,
        known: item.known,
        unknownItems: item.unknownItems,
        skipped: item.skipped,
        gap: item.gap,
      }
    }
    throw protocolError("wish import")
  })
}

export function parseProgress(value: unknown): WishProgress | null {
  if (!isRecord(value) || !isNumber(value.uid) || !Array.isArray(value.banners)) return null
  const banners = value.banners.flatMap(item =>
    isRecord(item) &&
    isNumber(item.banner) &&
    isNumber(item.added) &&
    typeof item.done === "boolean"
      ? [{ banner: item.banner, added: item.added, done: item.done }]
      : [],
  )
  return { uid: value.uid, banners }
}

const READ_ERRORS = ["expired", "busy", "failed", "otherAccount", "stopped"] as const

export function parseReadEnd(value: unknown): WishReadEnd | null {
  if (!isRecord(value) || !isNumber(value.uid) || !Array.isArray(value.added)) return null
  const added = value.added.flatMap((pair): [number, number][] =>
    Array.isArray(pair) && isNumber(pair[0]) && isNumber(pair[1]) ? [[pair[0], pair[1]]] : [],
  )
  const error = READ_ERRORS.find(kind => kind === value.error) ?? null
  return { uid: value.uid, added, error }
}

export async function getWishes(uid: number) {
  return parseStoredWishes(await call("wish_records", { uid }))
}

/** The accounts a UIGF file has; fails with `notJson`, `notUigf` or `oldVersion`. */
export async function readWishFile(text: string) {
  return parseFileAccounts(await call("read_wish_file", { text }))
}

export async function importWishFile(text: string, uids: number[]) {
  return parseImports(await call("import_wish_file", { text, uids }))
}

/**
 * Writes the account's UIGF file where the user picks; the path, or null when
 * they cancel. `items`: each item's name and type in `lang`, by item id.
 */
export async function exportWishFile(
  uid: number,
  items: Record<number, [string, string]>,
  lang: string,
  fileName: string,
) {
  const value = await call("export_wish_file", { uid, items, lang, fileName })
  if (value === null || typeof value === "string") return value
  throw protocolError("wish export")
}

export async function revealFile(path: string) {
  await call("reveal_file", { path })
}

export async function openUigf() {
  await call("open_uigf")
}

export function onWishProgress(handler: (progress: WishProgress) => void): Promise<UnlistenFn> {
  return listen<unknown>("wishes-progress", event => {
    const progress = parseProgress(event.payload)
    if (progress) handler(progress)
  })
}

export function onWishRead(handler: (end: WishReadEnd) => void): Promise<UnlistenFn> {
  return listen<unknown>("wishes-read", event => {
    const end = parseReadEnd(event.payload)
    if (end) handler(end)
  })
}
