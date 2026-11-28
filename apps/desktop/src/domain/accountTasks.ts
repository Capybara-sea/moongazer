// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The export's `gi_tasks` and `gi_events`, read as leniently as the rest of
 * the account: a malformed field reads as missing. Times are milliseconds.
 */

import { RESIN_CAP } from "@/domain/daily"
import { count, list, ms, num, record, str } from "@/domain/json"

export type Fate = { item: string; currency: string; bought: number; limit?: number }

export type Tasks = {
  resin?: { value: number; nextAt?: number }
  commissions?: { finished: number; total: number; claimed: boolean }
  /** `comfort` is the highest Adeptal Energy among the realm layouts, which sets the rate. */
  realm?: { value: number; limit: number; comfort?: number }
  /** The discounts left this week, of `limit`. */
  weeklyBosses?: { left: number; limit: number }
  /** Who is out, one per slot in use; empty when nobody is. */
  expeditions?: { character?: string; doneAt: number }[]
  transformer?: { usedAt: number; readyAt: number }
  welkin?: { days: number }
  abyss?: { start: number; end: number; stars: number; maxStars: number }
  /** The Adventure Ranks whose reward was claimed. */
  arRewards?: number[]
  /** Paimon's Bargains as the shop last showed it: this month's counts as of `at`. */
  bargains?: { at: number; fates: Fate[] }
  /** Original Resin spent on the game day of `at`, as the training event (5294) counts it. */
  resinSpent?: { value: number; at: number }
  /** The weapon event's Epitomized Path as the wish screen last showed it. */
  wishPath?: { weapon: string; points: number }
}

/** One reward tier of an event. */
export type EventCounter = { progress: number; total: number; claimed: boolean }

export type GameEvent = {
  /** The activity id. */
  id: number
  start: number
  end: number
  /** Missing when the event has no counters. */
  counters?: EventCounter[]
}

function weeklyBosses(raw: Record<string, unknown>): NonNullable<Tasks["weeklyBosses"]> {
  const limit = count(raw.limit)
  // Capture 1.13.2 and before had no `used` and wrote the discounts used as `left`.
  const left = num(raw.used) === undefined ? limit - count(raw.left) : count(raw.left)
  return { left: Math.max(0, left), limit }
}

function resinSpent(value: unknown): Tasks["resinSpent"] {
  const raw = record(value)
  const at = ms(raw?.at)
  return at === undefined ? undefined : { value: count(raw?.value), at }
}

function bargains(value: unknown): Tasks["bargains"] {
  const raw = record(value)
  const at = ms(raw?.at)
  if (at === undefined) return undefined
  const fates = (list(raw?.fates) ?? []).flatMap(item => {
    const fate = record(item)
    const name = str(fate?.item)
    if (!fate || name === undefined) return []
    const limit = num(fate.limit)
    return [{ item: name, currency: str(fate.currency) ?? "", bought: count(fate.bought), limit }]
  })
  return { at, fates }
}

function wishPath(value: unknown): Tasks["wishPath"] {
  const raw = record(value)
  const weapon = str(raw?.weapon)
  return weapon === undefined ? undefined : { weapon, points: count(raw?.points) }
}

/**
 * `heldResin` is the player's resin, as at login or the last change; `comfort` the Adeptal
 * Energy that sets the Realm Currency rate.
 */
export function parseTasks(
  value: unknown,
  heldResin: number | undefined,
  comfort: number | undefined,
): Tasks | undefined {
  const raw = record(value)
  if (!raw) return undefined
  const resin = record(raw.resin)
  const commissions = record(raw.commissions)
  const realm = record(raw.realm)
  const bosses = record(raw.weeklyBosses)
  const transformer = record(raw.transformer)
  const welkin = record(raw.welkin)
  const abyss = record(raw.abyss)
  const usedAt = ms(transformer?.usedAt)
  const readyAt = ms(transformer?.readyAt)
  const start = ms(abyss?.start)
  const end = ms(abyss?.end)
  return {
    // At the cap no next point comes, so the game sends no time and Capture
    // leaves the clock out; full resin stays full until spent.
    resin: resin
      ? { value: count(resin.value), nextAt: ms(resin.nextAt) }
      : heldResin !== undefined && heldResin >= RESIN_CAP
        ? { value: heldResin }
        : undefined,
    commissions: commissions && {
      finished: count(commissions.finished),
      total: count(commissions.total),
      claimed: commissions.claimed === true,
    },
    realm: realm && { value: count(realm.value), limit: count(realm.limit), comfort },
    weeklyBosses: bosses && weeklyBosses(bosses),
    expeditions: list(raw.expeditions)?.flatMap(item => {
      const doneAt = ms(record(item)?.doneAt)
      return doneAt === undefined ? [] : [{ character: str(record(item)?.character), doneAt }]
    }),
    transformer: usedAt !== undefined && readyAt !== undefined ? { usedAt, readyAt } : undefined,
    welkin: welkin && { days: count(welkin.days) },
    abyss:
      start !== undefined && end !== undefined
        ? { start, end, stars: count(abyss?.stars), maxStars: count(abyss?.maxStars) }
        : undefined,
    arRewards: list(raw.arRewards)?.flatMap(rank => num(rank) ?? []),
    bargains: bargains(raw.bargains),
    resinSpent: resinSpent(raw.resinSpent),
    wishPath: wishPath(raw.wishPath),
  }
}

export function parseEvents(value: unknown): GameEvent[] | undefined {
  const raw = record(value)
  if (!raw) return undefined
  return Object.entries(raw).flatMap(([key, item]) => {
    const id = Number(key)
    const entry = record(item)
    const start = ms(entry?.start)
    const end = ms(entry?.end)
    if (!Number.isInteger(id) || start === undefined || end === undefined) return []
    const progress = record(entry?.progress)
    const counters = progress
      ? Object.values(progress).flatMap(counter => {
          const fields = record(counter)
          if (!fields) return []
          return [
            {
              progress: count(fields.progress),
              total: count(fields.total),
              claimed: fields.claimed === true,
            },
          ]
        })
      : undefined
    return [{ id, start, end, counters }]
  })
}
