// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * What lib/backend and lib/backend/sync share: the command call, its error
 * and the runtime checks every response goes through.
 */

import { invoke } from "@tauri-apps/api/core"

export class BackendError extends Error {
  readonly kind: string

  constructor(kind: string, message: string) {
    super(message)
    this.name = "BackendError"
    this.kind = kind
  }
}

export function protocolError(what: string) {
  return new BackendError("protocol", `unexpected ${what} from the backend`)
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

export async function call(command: string, args?: Record<string, unknown>): Promise<unknown> {
  try {
    return await invoke<unknown>(command, args)
  } catch (error) {
    throw toBackendError(error)
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export const isNumber = (value: unknown): value is number => typeof value === "number"
export const isNullableNumber = (value: unknown): value is number | null =>
  value === null || typeof value === "number"
export const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string"
export const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string")
export const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  list.some(item => item === value)
