// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { isRecord } from "@/lib/backend/shared"

/** A package, component or data source, as `cargo xtask notices` writes it to notices.json. */
export type LicenseEntry = {
  name: string
  version?: string
  /** What applies; data without a license has none. */
  license?: string
  /** The package's own expression, where it offers a choice ("MIT OR Apache-2.0"). */
  expression?: string
  copyright: string[]
  note?: string
  /** Keys into the text table, since hundreds of entries share the MIT text. */
  texts: string[]
  links?: string[]
}

export type LicenseGroup = { id: string; entries: LicenseEntry[] }

/** The npm packages in the bundle, with their texts keyed for the text table. */
export type Frontend = { entries: LicenseEntry[]; texts: Record<string, string> }

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string"

/** Vite's license file (`build.license` in vite.config.ts): name, version, identifier, text. */
export function parseFrontend(value: unknown): Frontend {
  if (!Array.isArray(value)) throw new Error("the license file is not a list")
  const entries: LicenseEntry[] = []
  const texts: Record<string, string> = {}
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.name !== "string" ||
      typeof item.version !== "string" ||
      !isOptionalString(item.identifier) ||
      !isOptionalString(item.text)
    ) {
      throw new Error("the license file has a malformed entry")
    }
    const key = `npm:${item.name}@${item.version}`
    if (item.text) texts[key] = item.text
    entries.push({
      name: item.name,
      version: item.version,
      license: item.identifier,
      copyright: [],
      texts: item.text ? [key] : [],
    })
  }
  return { entries, texts }
}

/**
 * Vite writes the file only in a build; the dev server would answer with the
 * app's own page instead.
 */
export async function loadFrontend() {
  const response = await fetch("/licenses.json")
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseFrontend(await response.json())
}

/** notices.json's frontend group holds only the CSS packages, which Vite's file leaves out. */
export function withFrontend(groups: LicenseGroup[], frontend: LicenseEntry[]): LicenseGroup[] {
  return groups.map(group =>
    group.id === "frontend"
      ? {
          ...group,
          entries: [...group.entries, ...frontend].sort((a, b) =>
            a.name.localeCompare(b.name, "en"),
          ),
        }
      : group,
  )
}
