// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { type Artifact, SLOTS, type SlotKey } from "@/domain/good"
import { lookup } from "@/domain/names"

/** An artifact with its set's and wielder's names, as a card shows it. */
export type ArtifactRow = {
  /** The artifact's place in the export: artifacts have no id of their own. */
  id: number
  artifact: Artifact
  setName: string
  /** The wielder's name; none when unequipped. */
  wielder?: string
}

const byName = new Intl.Collator("zh").compare

/**
 * The rows in the page's order: level, then rarity, both highest first, then
 * set name, then slot from flower to circlet, then the export's order.
 */
export function artifactRows(artifacts: readonly Artifact[]): ArtifactRow[] {
  return artifacts
    .map((artifact, id) => ({
      id,
      artifact,
      setName: lookup("artifactSets", artifact.setKey).name,
      wielder: artifact.location ? lookup("characters", artifact.location).name : undefined,
    }))
    .sort(
      (a, b) =>
        b.artifact.level - a.artifact.level ||
        b.artifact.rarity - a.artifact.rarity ||
        byName(a.setName, b.setName) ||
        SLOTS.indexOf(a.artifact.slotKey) - SLOTS.indexOf(b.artifact.slotKey) ||
        a.id - b.id,
    )
}

/** The numbers in the page's subtitle. */
export function artifactCounts(rows: readonly ArtifactRow[]) {
  return {
    total: rows.length,
    maxed: rows.filter(row => row.artifact.level === 20).length,
    equipped: rows.filter(row => row.artifact.location !== "").length,
  }
}

/** The sets in the rows, by name, with how many pieces of each, as options of the set filter. */
export function setOptions(rows: readonly ArtifactRow[]) {
  const sets = new Map<string, { value: string; label: string; count: number }>()
  for (const { artifact, setName } of rows) {
    const set = sets.get(artifact.setKey)
    if (set) set.count++
    else sets.set(artifact.setKey, { value: artifact.setKey, label: setName, count: 1 })
  }
  return [...sets.values()].sort((a, b) => byName(a.label, b.label))
}

type Options = { slot: SlotKey | null; set: string | null; onlyFree: boolean }

/** The rows that pass the filters, in their order. */
export function visibleArtifacts(rows: readonly ArtifactRow[], { slot, set, onlyFree }: Options) {
  return rows.filter(
    ({ artifact }) =>
      (slot === null || artifact.slotKey === slot) &&
      (set === null || artifact.setKey === set) &&
      (!onlyFree || artifact.location === ""),
  )
}
