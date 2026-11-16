// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Names of game items by GOOD key, from the table `cargo xtask gen-data`
 * builds before every frontend build.
 */

import names from "@/generated/names.json"

export const NAME_KINDS = ["characters", "weapons", "artifactSets", "materials"] as const
export type NameKind = (typeof NAME_KINDS)[number]

const tables: Record<NameKind, Record<string, { name: string }>> = names

/** The keys the bundled data has no name for: it predates those items. */
export function unnamed(kind: NameKind, keys: readonly string[]) {
  return keys.filter(key => !Object.hasOwn(tables[kind], key))
}
