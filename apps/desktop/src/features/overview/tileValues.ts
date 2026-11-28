// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { text } from "@/i18n"
import type { Snapshot } from "@/lib/backend"
import {
  formatAmount,
  formatMonthDay,
  formatNumber,
  formatTime,
  type Signed,
  signedDelta,
} from "@/lib/format"
import type { PageKey } from "@/lib/route"

/** The changes since the snapshot before, then a note on them; or a note alone. */
type Change = { deltas: Signed[]; note: string }

export type Tile = {
  label: string
  value: string
  /** Set when the value is a note rather than a count: why there is no count. */
  hint?: string
  /**
   * Null when no change line is shown: the count is unknown, or no older
   * snapshot has one to compare with.
   */
  change: Change | null
  /** The page the tile opens, once that page exists. */
  page?: PageKey
}

const { tiles } = text
const noted = (note: string): Change => ({ deltas: [], note })
const FIRST = noted(tiles.first)

function since(deltas: [number] | [number, number]): Change {
  return { deltas: deltas.map(signedDelta), note: tiles.sincePrevious }
}

/**
 * The six totals of a snapshot, each with its change since the snapshot
 * before (`older` is every older one, newest first). A snapshot without
 * materials knows no Mora or Primogems, so currencies compare with the last
 * snapshot that did, and show its values when it has none.
 */
export function countTiles(snapshot: Snapshot, older: Snapshot[]): Tile[] {
  const now = snapshot.summary
  const before = older[0]?.summary

  function currency(label: string, key: "mora" | "primogems"): Tile {
    // Mora runs to millions; Primogems stay exact.
    const format = key === "mora" ? formatAmount : formatNumber
    const known = older.find(s => s.summary[key] !== null)
    const last = known?.summary[key] ?? null
    const value = now[key]
    if (value === null) {
      if (!known || last === null) return { label, value: text.number.missing, change: null }
      const when = `${formatMonthDay(known.takenAt)} ${formatTime(known.takenAt)}`
      return { label, value: format(last), change: noted(tiles.borrowed(when)) }
    }
    const change = older.length === 0 ? FIRST : last === null ? null : since([value - last])
    return { label, value: format(value), change }
  }

  function count(label: string, key: "characters" | "weapons" | "artifacts"): Tile {
    const value = now[key]
    return {
      label,
      value: formatNumber(value),
      change: before ? since([value - before[key]]) : FIRST,
    }
  }

  function lowArtifacts(): Tile {
    const label = tiles.lowArtifacts
    const four = now.artifacts4
    const three = now.artifacts3
    if (four === null || three === null) return { label, value: text.number.missing, change: null }
    if (four === 0 && three === 0) {
      return { label, value: tiles.notIncluded, hint: tiles.notIncludedHint, change: null }
    }
    const value = tiles.pair(formatNumber(four), formatNumber(three))
    if (!before) return { label, value, change: FIRST }
    const { artifacts4: fourBefore, artifacts3: threeBefore } = before
    // A snapshot without any is taken as filtered by the export, not as a count to compare with.
    const known = fourBefore !== null && threeBefore !== null && fourBefore + threeBefore > 0
    const change = known ? since([four - fourBefore, three - threeBefore]) : null
    return { label, value, change }
  }

  return [
    currency(tiles.mora, "mora"),
    currency(tiles.primogems, "primogems"),
    { ...count(tiles.characters, "characters"), page: "characters" },
    { ...count(tiles.weapons, "weapons"), page: "weapons" },
    { ...count(tiles.artifacts, "artifacts"), page: "artifacts" },
    { ...lowArtifacts(), page: "artifacts" },
  ]
}
