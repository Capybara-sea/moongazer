// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The anecdotes page's data: the game's anecdotes from the table `cargo xtask
 * gen-data` builds, with the hand-written rules for the ones that give other
 * than one seal, and what an account has of them.
 */

import { collection as data } from "@/domain/gameData"
import { text } from "@/i18n"
import type { Account, AnecdoteEntry } from "./account"
import { lookup } from "./names"

export type AnecdoteInfo = {
  id: number
  area: number
  /** A GOOD key, or the name of a character that is not playable. */
  character: string
  title: string
  summary: string
  hint?: string
  hidden?: boolean
  after?: number
  /** "day" or "night" where it comes only then. */
  time?: string
  /** From the hand-written guide: where it is met and, for a hidden one, what brings it on. */
  place?: string
  trigger?: string
  /** Anecdotes to record first. */
  requires?: number[]
  /** A main quest to finish first, by its last quest's id. */
  quest?: { id: number; name: string }
  /** A character to have, by GOOD key. */
  owns?: string
  tip?: string
  /** What the guide's author has not confirmed. */
  unsure?: string
}

/**
 * Something to do before an anecdote can come, and whether the account has
 * done it; unknown where the export does not say (finished quests).
 */
export type Need =
  | { kind: "anecdote"; id: number; met: boolean }
  | { kind: "quest"; name: string; met?: boolean }
  | { kind: "character"; key: string; met: boolean }

type Rules = {
  daily: { id: number; last: number; total: number }
  lauma: { character: string; choice: number; farewell: number; seals: number; days: number }
  chains: number[][]
}

type Table = {
  anecdoteAreas: Record<string, string>
  anecdotes: AnecdoteInfo[]
  anecdoteVariants: Record<string, number>
  anecdoteReward: { seals: number; primogems: number }
  anecdoteRules: Rules
}

const table: Table = data
const byId = new Map(table.anecdotes.map(a => [a.id, a]))

export const ANECDOTE_RULES = table.anecdoteRules
export const ANECDOTE_REWARD = table.anecdoteReward
export const ANECDOTE_AREAS = Object.entries(table.anecdoteAreas)
  .map(([id, name]) => ({ id: Number(id), name }))
  .sort((a, b) => a.id - b.id)
/** Non-hidden anecdotes a day, as the fastest estimate assumes; hidden ones come one a day. */
export const PER_DAY = 2

export function anecdoteInfo(id: number) {
  return byId.get(id)
}

/** "Character·title", as the game writes it. */
export function anecdoteName(id: number) {
  const info = byId.get(id)
  return info ? text.anecdotePage.named(characterName(info.character), info.title) : String(id)
}

/** A character not playable has its name for a key. */
export function characterName(key: string) {
  return /^[A-Za-z]/.test(key) ? lookup("characters", key).name : key
}

/**
 * recorded: the game counts it, waiting: it is out in the world now, unmet:
 * not met yet, absent: it cannot come for this account (Aino's farewell
 * without Lauma).
 */
export type AnecdoteStatus = "recorded" | "waiting" | "unmet" | "absent"

export type AnecdoteRow = {
  info: AnecdoteInfo
  status: AnecdoteStatus
  /** Recorded at least once, as the game counts it, even while it runs again. */
  recorded: boolean
  /** Days done of one that comes back on several days. */
  days?: number
  /** Seals it gives, where that is fixed. */
  seals?: number
  /** Times it still has to be done: more than one for Aino's choice without Lauma. */
  left: number
  /** What the guide says to do first; empty for most. */
  needs: Need[]
}

export type AnecdoteView = {
  hasLauma: boolean
  /** Every anecdote, those that cannot come too, in the game's order. */
  rows: AnecdoteRow[]
  /** Of those that can come. */
  total: number
  hidden: number
  recorded: number
  waiting: number
  unmet: number
  seals: {
    total: number
    /** The game's own count; missing when the export has no reward progress. */
    earned?: number
    reward?: { claimed: number; progress: number; target: number; full: boolean }
  }
  fastest: Fastest
  unlockedAreas: ReadonlySet<number>
  /** Ids in the export that the bundled table lacks: a newer game version added them. */
  newer: number
}

export type Fastest = {
  days: number
  hidden: number
  normal: number
  /** The chain that takes the most days, with them. */
  chain?: { ids: number[]; days: number }
}

/** The export's entries by main id: an export can have a variant's id instead. */
function entriesByMain(entries: ReadonlyMap<number, AnecdoteEntry>) {
  const byMain = new Map<number, AnecdoteEntry>()
  let newer = 0
  for (const [id, entry] of entries) {
    const main = table.anecdoteVariants[String(id)] ?? id
    if (!byId.has(main)) newer++
    else if (!byMain.has(main) || main === id) byMain.set(main, entry)
  }
  return { byMain, newer }
}

export function anecdoteView(account: Account): AnecdoteView | undefined {
  const anecdotes = account.anecdotes
  if (!anecdotes) return undefined
  const { daily, lauma } = table.anecdoteRules
  const { byMain, newer } = entriesByMain(anecdotes.entries)
  // An account that met the farewell had Lauma then, if not in this export.
  const hasLauma =
    account.characters.some(c => c.key === lauma.character) || byMain.has(lauma.farewell)
  const waitDays = byMain.get(daily.id)?.finishCount ?? 0
  const choiceDays = byMain.get(lauma.choice)?.finishCount ?? 0
  // Aino's choice done on all its days before Lauma came: the farewell gives the rest of the
  // pair's seals instead.
  const lateLauma = hasLauma && choiceDays >= lauma.days
  const isRecorded = (id: number) => {
    const entry = byMain.get(id)
    return entry !== undefined && (entry.state === 3 || entry.finishCount > 0)
  }
  const quests = account.collections?.quests
  const owned = new Set(account.characters.map(c => c.key))
  const needsOf = (info: AnecdoteInfo): Need[] => [
    ...(info.requires ?? []).map(id => ({ kind: "anecdote" as const, id, met: isRecorded(id) })),
    ...(info.quest
      ? [{ kind: "quest" as const, name: info.quest.name, met: quests?.has(info.quest.id) }]
      : []),
    ...(info.owns
      ? [{ kind: "character" as const, key: info.owns, met: owned.has(info.owns) }]
      : []),
  ]
  const rows = table.anecdotes.map((info): AnecdoteRow => {
    const entry = byMain.get(info.id)
    const recorded = isRecorded(info.id)
    const needs = needsOf(info)
    if (info.id === lauma.farewell && !hasLauma) {
      return { info, status: "absent", recorded: false, seals: lauma.seals, left: 0, needs }
    }
    const status = entry?.state === 2 ? "waiting" : recorded ? "recorded" : "unmet"
    const row: AnecdoteRow = { info, status, recorded, left: recorded ? 0 : 1, needs }
    if (info.id === daily.id) return { ...row, days: waitDays }
    if (info.id === daily.last)
      return waitDays > 0 ? { ...row, seals: daily.total - waitDays } : row
    if (info.id === lauma.farewell) {
      return { ...row, seals: lateLauma ? lauma.seals + 1 - lauma.days : lauma.seals }
    }
    if (info.id === lauma.choice && lateLauma) {
      return { ...row, days: choiceDays, seals: lauma.days }
    }
    if (info.id === lauma.choice && !hasLauma) {
      return {
        ...row,
        days: choiceDays,
        seals: lauma.days,
        left: Math.max(lauma.days - choiceDays, 0),
      }
    }
    return { ...row, seals: 1 }
  })
  const counted = rows.filter(r => r.status !== "absent")
  const reward = anecdotes.reward
  const target = reward && reward.target > 0 ? reward.target : table.anecdoteReward.seals
  return {
    hasLauma,
    rows,
    total: counted.length,
    hidden: counted.filter(r => r.info.hidden).length,
    recorded: counted.filter(r => r.recorded).length,
    waiting: counted.filter(r => r.status === "waiting").length,
    unmet: counted.filter(r => r.status === "unmet").length,
    seals: {
      total: counted.reduce((sum, r) => sum + sealsInTotal(r, hasLauma), 0),
      earned: reward && reward.index * target + reward.progress,
      reward: reward && {
        claimed: reward.index,
        progress: reward.progress,
        target,
        full: reward.progress >= target,
      },
    },
    fastest: fastest(counted),
    unlockedAreas: anecdotes.unlockedAreas,
    newer,
  }
}

/** Heizou's two give `total` together, all counted on the second. */
function sealsInTotal(row: { info: AnecdoteInfo }, hasLauma: boolean) {
  const { daily, lauma } = table.anecdoteRules
  if (row.info.id === daily.id) return 0
  if (row.info.id === daily.last) return daily.total
  if (row.info.id === lauma.farewell) return lauma.seals
  if (row.info.id === lauma.choice && !hasLauma) return lauma.days
  return 1
}

/** Anecdotes and seals in all, for an account with Lauma and one without. */
export const ANECDOTE_TOTALS = (() => {
  const all = table.anecdotes.map(info => ({ info }))
  const without = all.filter(r => r.info.id !== table.anecdoteRules.lauma.farewell)
  const seals = (rows: { info: AnecdoteInfo }[], hasLauma: boolean) =>
    rows.reduce((sum, r) => sum + sealsInTotal(r, hasLauma), 0)
  return {
    withLauma: { entries: all.length, seals: seals(all, true) },
    withoutLauma: { entries: without.length, seals: seals(without, false) },
    hidden: all.filter(r => r.info.hidden).length,
  }
})()

/**
 * At least how many days the rest take: hidden ones come one a day, others
 * PER_DAY a day, and each link of a chain a day after the one before, two
 * days for a chain at least. The game's prerequisites are mostly unknown, so
 * it is a lower bound.
 */
function fastest(rows: readonly AnecdoteRow[]): Fastest {
  const left = new Map(rows.map(r => [r.info.id, r.left]))
  let hidden = 0
  let normal = 0
  for (const row of rows) {
    if (row.info.hidden) hidden += row.left > 0 ? 1 : 0
    else normal += row.left
  }
  let chain: Fastest["chain"]
  for (const ids of table.anecdoteRules.chains) {
    const open = ids.filter(id => (left.get(id) ?? 0) > 0)
    if (open.length === 0) continue
    const days = Math.max(Math.min(open.length, 2), ...open.map(id => left.get(id) ?? 0))
    if (!chain || days > chain.days) chain = { ids, days }
  }
  return {
    days: Math.max(hidden, Math.ceil(normal / PER_DAY), chain?.days ?? 0),
    hidden,
    normal,
    chain,
  }
}

/** Whether a row still waits to be done: not yet recorded, out now, or days left. */
export function isTodo(row: AnecdoteRow) {
  return row.status === "waiting" || row.status === "unmet" || row.left > 0
}

export type CharacterGroup = { character: string; rows: AnecdoteRow[]; done: number; todo: number }

/** The rows by character, newest characters first: by their newest anecdote. */
export function byCharacter(rows: readonly AnecdoteRow[]): CharacterGroup[] {
  const groups = new Map<string, AnecdoteRow[]>()
  for (const row of rows) {
    groups.set(row.info.character, [...(groups.get(row.info.character) ?? []), row])
  }
  const newest = (g: AnecdoteRow[]) => Math.max(...g.map(r => r.info.id))
  return [...groups]
    .sort(([, a], [, b]) => newest(b) - newest(a))
    .map(([character, group]) => {
      const counted = group.filter(r => r.status !== "absent")
      return {
        character,
        rows: group,
        done: counted.filter(r => r.recorded).length,
        todo: counted.filter(isTodo).length,
      }
    })
}

/** The characters with anecdotes in an area, every character for null; the counts are the area's. */
export function byCharacterIn(rows: readonly AnecdoteRow[], area: number | null) {
  return byCharacter(area === null ? rows : rows.filter(r => r.info.area === area))
}

/** Whether a character has any anecdote in an area. */
export function hasAnecdoteIn(rows: readonly AnecdoteRow[], character: string, area: number) {
  return rows.some(r => r.info.character === character && r.info.area === area)
}

export type AnecdoteFilters = {
  onlyTodo: boolean
  onlyHidden: boolean
  area: number | null
  character: string | null
  query: string
}

/** The rows that pass; the summary of one not recorded yet is not searched. */
export function visibleRows(rows: readonly AnecdoteRow[], filters: AnecdoteFilters) {
  const q = filters.query.trim().toLowerCase()
  return rows.filter(row => {
    const { info } = row
    if (filters.onlyTodo && !isTodo(row)) return false
    if (filters.onlyHidden && !info.hidden) return false
    if (filters.area !== null && info.area !== filters.area) return false
    if (filters.character !== null && info.character !== filters.character) return false
    if (!q) return true
    return [
      info.title,
      info.hint ?? "",
      row.recorded ? info.summary : "",
      characterName(info.character),
    ].some(s => s.toLowerCase().includes(q))
  })
}
