// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { lookup } from "@/domain/names"
import { isRecord } from "@/lib/backend/shared"
import type { Batch, Changed } from "@/lib/backend/sync"
import { formatNumber, formatTimeWithSeconds, type Labeled, movedTo, wayOf } from "@/lib/format"
import { text } from "@/text"

const c = text.sync.change
const detail = text.characterDetail
const FIELDS: Record<string, string> = {
  level: detail.level,
  ascension: detail.ascension,
  constellation: detail.constellation,
}
const WEAPON_FIELDS: Record<string, string> = {
  level: detail.level,
  ascension: detail.ascension,
  refinement: detail.refinement,
}
const TALENTS = ["auto", "skill", "burst"] as const
/** Listed first, in this order; other materials come last. */
const CURRENCIES = ["Primogem", "Mora"]
const SECOND = 1000
/** An item's path (`weapons.<guid>`, `characters.<key>`) is this long; its fields lie under it. */
const ITEM = 2

const numberOf = (value: unknown) => (typeof value === "number" ? value : undefined)
const keyOf = (item: unknown) =>
  isRecord(item) && typeof item.key === "string" ? item.key : undefined
const isTalent = (value: string): value is (typeof TALENTS)[number] =>
  TALENTS.some(talent => talent === value)
/** GOOD values from the same source, which writes an object's keys in the same order. */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const plain = (label: string): Labeled => ({ label, change: null })

function count(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

/** How many ids `after` holds that `before` does not. */
function addedIds(before: unknown, after: unknown) {
  if (!Array.isArray(after)) return 0
  const had = new Set<unknown>(Array.isArray(before) ? before : [])
  return after.filter(id => !had.has(id)).length
}

/** "<name> · <label> 80" then "→ 90", or "<name> · <label>" then "→ 7" when there was none. */
function moved(name: string, label: string, from: unknown, to: unknown): Labeled[] {
  const now = numberOf(to)
  if (now === undefined || from === to) return []
  const was = numberOf(from)
  if (was === undefined) return [{ label: c.named(name, label), change: movedTo(0, now) }]
  return [{ label: c.named(name, detail.changedFrom(label, was)), change: movedTo(was, now) }]
}

/** One character's lines: joined, or a level, ascension, constellation or talent that moved. */
function characterLines(key: string, path: string[], before: unknown, after: unknown): Labeled[] {
  const name = lookup("characters", key).name
  const [, , field, talent] = path
  if (field === undefined) {
    if (before === null) return after === null ? [] : [plain(c.gained(name, 1))]
    if (!isRecord(before) || !isRecord(after)) return []
    // Both whole: merged batches that took the character out and back in.
    const was = isRecord(before.talent) ? before.talent : {}
    const now = isRecord(after.talent) ? after.talent : {}
    return [
      ...Object.entries(FIELDS).flatMap(([at, label]) => moved(name, label, before[at], after[at])),
      ...TALENTS.flatMap(at => moved(name, text.game.talents[at], was[at], now[at])),
    ]
  }
  if (field === "talent") {
    return talent !== undefined && isTalent(talent)
      ? moved(name, text.game.talents[talent], before, after)
      : []
  }
  const label = FIELDS[field]
  return label === undefined ? [] : moved(name, label, before, after)
}

/**
 * Names the changes: currencies first, then characters, weapons, artifacts,
 * achievements and other materials. A weapon's level, ascension or
 * refinement and an artifact's level are named by the item's key the change
 * carries. Other sections (the player, quests and so on) are left out.
 */
export function changeLines(changes: readonly Changed[]): Labeled[] {
  const currencies = new Map<string, Labeled>()
  const materials: Labeled[] = []
  const characters: Labeled[] = []
  const weapons: Labeled[] = []
  const artifacts: Labeled[] = []
  const weaponsGained = new Map<string, number>()
  const weaponsUsed = new Map<string, number>()
  let artifactsGained = 0
  let artifactsUsed = 0
  let achievements = 0

  for (const change of changes) {
    const { path, before, after } = change
    const [section, key, field] = path
    // Kept as one list of ids.
    if (section === "gi_achievements" && key === undefined) {
      achievements += addedIds(before, after)
      continue
    }
    if (key === undefined) continue
    const whole = field === undefined
    switch (section) {
      case "materials": {
        const delta = (numberOf(after) ?? 0) - (numberOf(before) ?? 0)
        if (!whole || delta === 0) break
        const sign = delta > 0 ? "+" : "-"
        const line = {
          label: lookup("materials", key).name,
          change: { text: sign + formatNumber(Math.abs(delta)), way: wayOf(delta) },
        }
        if (CURRENCIES.includes(key)) currencies.set(key, line)
        else materials.push(line)
        break
      }
      case "characters":
        characters.push(...characterLines(key, path, before, after))
        break
      case "weapons": {
        const gained = before === null ? keyOf(after) : undefined
        const used = after === null ? keyOf(before) : undefined
        const label = whole ? undefined : WEAPON_FIELDS[field]
        if (whole && gained !== undefined) count(weaponsGained, gained)
        else if (whole && used !== undefined) count(weaponsUsed, used)
        else if (label !== undefined && change.key !== null) {
          weapons.push(...moved(lookup("weapons", change.key).name, label, before, after))
        }
        break
      }
      case "artifacts":
        if (whole && before === null && after !== null) artifactsGained++
        else if (whole && after === null && before !== null) artifactsUsed++
        else if (field === "level" && change.key !== null) {
          const set = lookup("artifactSets", change.key).name
          artifacts.push(...moved(set, c.artifactLevel, before, after))
        }
        break
    }
  }

  const named = (counts: Map<string, number>, line: (name: string, n: number) => string) =>
    [...counts].map(([key, n]) => plain(line(lookup("weapons", key).name, n)))
  const counted = (n: number, line: (n: number) => string) => (n > 0 ? [plain(line(n))] : [])
  return [
    ...CURRENCIES.flatMap(key => currencies.get(key) ?? []),
    ...characters,
    ...named(weaponsGained, c.gained),
    ...named(weaponsUsed, c.used),
    ...weapons,
    ...counted(artifactsGained, c.artifactsGained),
    ...counted(artifactsUsed, c.artifactsUsed),
    ...artifacts,
    ...counted(achievements, c.achievements),
    ...materials,
  ]
}

/** `value` with the field at `at` set to `to`; a value that is no record stays as it is. */
function withField(value: unknown, at: readonly string[], to: unknown): unknown {
  const [field, ...rest] = at
  if (field === undefined) return to
  if (!isRecord(value)) return value
  return { ...value, [field]: withField(value[field], rest, to) }
}

/**
 * The batches as one list: a path keeps its first before and its last
 * after, and one that ended where it began is left out. An item changed
 * whole (gained, used up) takes in its fields' changes from every batch,
 * so a piece leveled and then fed is only used up, and one gained and then
 * leveled only gained.
 */
export function mergeChanges(batches: readonly Batch[]): Changed[] {
  const byPath = new Map<string, Changed>()
  // The field paths changed so far under each item's path.
  const fields = new Map<string, string[]>()
  for (const batch of batches) {
    for (const change of batch.changes) {
      const key = JSON.stringify(change.path)
      const itemKey = JSON.stringify(change.path.slice(0, ITEM))
      const isField = change.path.length > ITEM
      const item = byPath.get(itemKey)
      const first = byPath.get(key)
      if (isField && item && isRecord(item.after)) {
        const after = withField(item.after, change.path.slice(ITEM), change.after)
        byPath.set(itemKey, { ...item, after })
      } else if (first) {
        byPath.set(key, { ...first, after: change.after })
      } else if (isField) {
        byPath.set(key, change)
        fields.set(itemKey, [...(fields.get(itemKey) ?? []), key])
      } else {
        let before = change.before
        for (const field of fields.get(key) ?? []) {
          const earlier = byPath.get(field)
          if (earlier) before = withField(before, earlier.path.slice(ITEM), earlier.before)
          byPath.delete(field)
        }
        fields.delete(key)
        byPath.set(key, { ...change, before })
      }
    }
  }
  return [...byPath.values()].filter(change => !same(change.before, change.after))
}

export type ChangeRow = { second: number; time: string; lines: Labeled[] }

/**
 * The batches (oldest first) by second, newest first, each second's merged
 * (batches are 15 s apart at least, so in practice a row is a batch). A
 * second with nothing to name is left out.
 */
export function changeRows(batches: readonly Batch[]): ChangeRow[] {
  const seconds = new Map<number, Batch[]>()
  for (const batch of batches) {
    const second = Math.floor(batch.at / SECOND)
    seconds.set(second, [...(seconds.get(second) ?? []), batch])
  }
  return [...seconds]
    .map(([second, group]) => ({
      second,
      time: formatTimeWithSeconds(second * SECOND),
      lines: changeLines(mergeChanges(group)),
    }))
    .filter(row => row.lines.length > 0)
    .reverse()
}
