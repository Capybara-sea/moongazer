// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { text } from "@/i18n"

type Kind = keyof typeof text.sync.leftOut

/** Upstream's reasons for leaving something out of an export; any other is "other". */
const KIND = new Map<string, Kind>([
  ["unknown_character", "characters"],
  ["unknown_weapon", "weapons"],
  ["unknown_artifact", "artifacts"],
  ["unknown_material", "materials"],
  ["unnamed_material", "materials"],
  ["unknown_affix", "affixes"],
  ["unknown_artifact_main_stat", "mainStats"],
  ["character_invalid_level", "characterData"],
  ["character_invalid_ascension", "characterData"],
  ["character_missing_level", "characterData"],
  ["character_missing_ascension", "characterData"],
  ["invalid_weapon_level", "weaponLevels"],
  ["invalid_artifact_level", "artifactLevels"],
  ["saturated_currency", "currencies"],
])

/**
 * What an export left out, from upstream's "reason: n, reason: n", in words
 * and summed per kind; empty when nothing in it reads as a count.
 */
export function leftOutText(leftOut: string): string {
  const counts = new Map<string, number>()
  for (const part of leftOut.split(",")) {
    const match = /^\s*(\w+)\s*:\s*(\d+)\s*$/.exec(part)
    if (!match) continue
    const [, reason = "", n = "0"] = match
    const kind = KIND.get(reason) ?? "other"
    counts.set(kind, (counts.get(kind) ?? 0) + Number(n))
  }
  const parts = Object.entries(text.sync.leftOut).flatMap(([kind, line]) => {
    const n = counts.get(kind)
    return n ? [line(n)] : []
  })
  return text.sync.leftOutList(parts)
}
