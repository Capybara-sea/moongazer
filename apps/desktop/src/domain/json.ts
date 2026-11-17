// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Lenient readers for export JSON: a value of the wrong type reads as
 * missing instead of throwing.
 */

export type Json = Record<string, unknown>

export function record(value: unknown): Json | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined
}

export function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** Leyline leaves zero counts out, so a missing number inside a present object is 0. */
export function count(value: unknown) {
  return num(value) ?? 0
}

/** Unix seconds to milliseconds. */
export function ms(value: unknown) {
  const seconds = num(value)
  return seconds === undefined ? undefined : seconds * 1000
}

export function str(value: unknown) {
  return typeof value === "string" ? value : undefined
}

export function list(value: unknown) {
  return Array.isArray(value) ? value : undefined
}

/** Items of a list, or keys of an object. */
export function size(value: unknown) {
  const object = record(value)
  return list(value)?.length ?? (object ? Object.keys(object).length : undefined)
}

/** `{ "<id>": n }` to a map with numeric keys; other entries are skipped. */
export function idMap(value: unknown) {
  const map = new Map<number, number>()
  for (const [key, entry] of Object.entries(record(value) ?? {})) {
    const id = Number(key)
    const n = num(entry)
    if (Number.isInteger(id) && n !== undefined) map.set(id, n)
  }
  return map
}
