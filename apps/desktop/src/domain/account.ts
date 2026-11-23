// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The parts of a Leyline export the pages show, read from the JSON
 * the backend hands over. Leyline leaves out whatever Capture did not see, so
 * every `gi_*` part is optional and a malformed field reads as missing.
 * Times are converted from unix seconds to milliseconds.
 */

import { RESIN_CAP } from "./daily"
import {
  type Artifact,
  artifacts,
  type Character,
  type CharacterInfo,
  characterInfo,
  characters,
  materials,
  type Weapon,
  weapons,
} from "./good"
import { count, idMap, type Json, list, ms, num, record, size, str } from "./json"

export type Player = {
  uid?: number
  ar?: number
  wl?: number
  nickname?: string
  signature?: string
  profilePicture?: number
  profileFrame?: number
  nameCard?: number
  birthday?: { month: number; day: number }
}

export type Tasks = {
  resin?: { value: number; nextAt?: number }
  commissions?: { finished: number; total: number; claimed: boolean }
  /** `comfort` is the highest Adeptal Energy among the realm layouts, which sets the rate. */
  realm?: { value: number; limit: number; comfort?: number }
  weeklyBosses?: { left: number; limit: number }
  expeditions?: { character?: string; doneAt: number }[]
  transformer?: { usedAt: number; readyAt: number }
  welkin?: { days: number }
  abyss?: { start: number; end: number; stars: number; maxStars: number }
}

export type AnecdoteEntry = { state: number; finishCount: number }

export type Anecdotes = {
  /** By the id the export has, which is a variant's own where the player met a variant. */
  entries: Map<number, AnecdoteEntry>
  /** The areas whose page the player has unlocked. */
  unlockedAreas: Set<number>
  reward?: { index: number; progress: number; target: number }
  lastWish?: number
}

export type Achievements = {
  /** Finished ones, with when where the game kept the time. */
  done: Map<number, number | undefined>
  /** Every unfinished one with its count; null when the export has no such list. */
  progress: Map<number, { current: number; total: number }> | null
}

export type Exploration = {
  /** City id to Statue of The Seven level. */
  statues: Map<number, number>
  reputation: Map<number, number>
  offerings: Map<number, number>
  /** Area id to raw exploration points; missing in co-op. */
  explore?: Map<number, number>
}

export type Theater = {
  season: number
  level?: number
  acts: number
  stars: number
  maxStars: number
  /** The acts that won a star, counted from 1; missing when Capture could not tell. */
  starredActs?: number[]
}
export type StygianRecord = {
  season: number
  difficulty: number
  at: number
  fights: { time: number; done: boolean; team: string[] }[]
}
export type AbyssPeriod = { season: number; floor: number; chamber: number; picked: string[] }
export type Endgame = { theater?: Theater; stygian?: StygianRecord[]; abyss?: AbyssPeriod[] }

export type Collections = {
  outfits?: number
  gliders?: number
  tcgCards?: number
  recipes?: number
  blueprints?: number
  hangouts?: { claimed: number; total: number }
  livingBeings?: number
  /** Finished main quests by id; missing when the export has no list. */
  quests?: ReadonlySet<number>
}

export type Account = {
  player?: Player
  /** Characters at friendship 10. */
  maxFriendship?: number
  achievements?: Achievements
  anecdotes?: Anecdotes
  tasks?: Tasks
  exploration?: Exploration
  endgame?: Endgame
  collections?: Collections
  characters: Character[]
  weapons: Weapon[]
  artifacts: Artifact[]
  /** Counts by material key, currencies included; empty when the file has none. */
  materials: Map<string, number>
  /** By character key. */
  characterInfo: Map<string, CharacterInfo>
  /** Which twin the Traveler is, by character id; only Moongazer's own sync writes it. */
  traveler?: number
}

function player(value: unknown): Player | undefined {
  const raw = record(value)
  if (!raw) return undefined
  const picture = record(raw.profilePicture)
  const birthday = record(raw.birthday)
  const month = num(birthday?.month)
  const day = num(birthday?.day)
  return {
    uid: num(raw.uid),
    ar: num(raw.ar),
    // World level 0 is left out like any zero; AR and the UID never are 0.
    wl: count(raw.wl),
    nickname: str(raw.nickname),
    signature: str(raw.signature),
    profilePicture: num(picture?.id),
    profileFrame: num(picture?.frameId),
    nameCard: num(raw.nameCard),
    birthday: month !== undefined && day !== undefined ? { month, day } : undefined,
  }
}

/**
 * The highest Adeptal Energy among the realm layouts: each layout's mansion and outdoor blocks
 * together. Realm Currency comes at the rate of the highest, not of the layout in use.
 */
function bestComfort(value: unknown): number | undefined {
  let best: number | undefined
  for (const layout of Object.values(record(record(value)?.comfort) ?? {})) {
    const raw = record(layout)
    if (!raw) continue
    const blocks = list(raw.blocks) ?? []
    const total = blocks.reduce((sum: number, block) => sum + count(block), count(raw.mansion))
    best = Math.max(best ?? 0, total)
  }
  return best
}

/**
 * `heldResin` is the player's resin, as at login or the last change; `comfort` the Adeptal
 * Energy that sets the Realm Currency rate.
 */
function tasks(
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
    weeklyBosses: bosses && { left: count(bosses.left), limit: count(bosses.limit) },
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
  }
}

function anecdotes(value: unknown): Anecdotes | undefined {
  const raw = record(value)
  if (!raw) return undefined
  const entries = new Map<number, AnecdoteEntry>()
  for (const [key, entry] of Object.entries(record(raw.anecdotes) ?? {})) {
    const id = Number(key)
    const fields = record(entry)
    if (!Number.isInteger(id) || !fields) continue
    entries.set(id, { state: count(fields.state), finishCount: count(fields.finishCount) })
  }
  const unlocked = (list(raw.unlockedAreas) ?? []).map(num)
  const reward = record(raw.reward)
  return {
    entries,
    unlockedAreas: new Set(unlocked.filter((id): id is number => id !== undefined)),
    reward: reward && {
      index: count(reward.index),
      progress: count(reward.progress),
      target: count(reward.target),
    },
    lastWish: ms(record(raw.wish)?.lastWishTime),
  }
}

function achievements(raw: Json): Achievements | undefined {
  const ids = list(raw.gi_achievements)
  if (!ids) return undefined
  const times = record(raw.gi_achievement_times)
  const done = new Map<number, number | undefined>()
  for (const id of ids) {
    if (typeof id === "number") done.set(id, ms(times?.[String(id)]))
  }
  const counts = record(raw.gi_achievement_progress)
  let progress: Achievements["progress"] = null
  if (counts) {
    progress = new Map()
    for (const [key, entry] of Object.entries(counts)) {
      const id = Number(key)
      const fields = record(entry)
      if (!Number.isInteger(id) || !fields) continue
      progress.set(id, { current: count(fields.progress), total: count(fields.total) })
    }
  }
  return { done, progress }
}

function exploration(value: unknown): Exploration | undefined {
  const raw = record(value)
  if (!raw) return undefined
  const statues = new Map<number, number>()
  for (const [key, entry] of Object.entries(record(raw.statues) ?? {})) {
    const level = num(record(entry)?.level)
    if (level !== undefined) statues.set(Number(key), level)
  }
  return {
    statues,
    reputation: idMap(raw.reputation),
    offerings: idMap(raw.offerings),
    explore: record(raw.explore) ? idMap(raw.explore) : undefined,
  }
}

function strings(value: unknown) {
  return list(value)?.filter(item => typeof item === "string") ?? []
}

function endgame(value: unknown): Endgame | undefined {
  const raw = record(value)
  if (!raw) return undefined
  const theater = record(raw.theater)
  const season = num(theater?.season)
  return {
    theater:
      theater && season !== undefined
        ? {
            season,
            level: num(theater.level),
            acts: count(theater.acts),
            stars: count(theater.stars),
            maxStars: count(theater.maxStars),
            starredActs: list(theater.starredActs)?.flatMap(act => num(act) ?? []),
          }
        : undefined,
    stygian: list(record(raw.stygian)?.records)?.flatMap(item => {
      const entry = record(item)
      const season = num(entry?.season)
      const at = ms(entry?.at)
      if (!entry || season === undefined || at === undefined) return []
      const fights = (list(entry.fights) ?? []).map(fight => ({
        time: count(record(fight)?.time),
        done: record(fight)?.done === true,
        team: strings(record(fight)?.team),
      }))
      return [{ season, difficulty: count(entry.difficulty), at, fights }]
    }),
    abyss: list(record(raw.abyss)?.periods)?.flatMap(item => {
      const entry = record(item)
      const season = num(entry?.season)
      if (!entry || season === undefined) return []
      const picked = (list(entry.picked) ?? []).flatMap(pick => str(record(pick)?.key) ?? [])
      return [{ season, floor: count(entry.floor), chamber: count(entry.chamber), picked }]
    }),
  }
}

function collections(raw: Json): Collections | undefined {
  const items = record(raw.gi_collections)
  const wardrobe = record(raw.gi_wardrobe)
  if (!items && !wardrobe) return undefined
  let hangouts: Collections["hangouts"]
  for (const chapter of Object.values(record(items?.hangouts) ?? {})) {
    hangouts ??= { claimed: 0, total: 0 }
    for (const ending of Object.values(record(record(chapter)?.endings) ?? {})) {
      hangouts.total++
      if (ending === "claimed") hangouts.claimed++
    }
  }
  const finished = list(record(items?.quests)?.finished)
  return {
    outfits: size(record(wardrobe?.outfits)?.owned),
    gliders: size(record(wardrobe?.gliders)?.owned),
    tcgCards: size(record(items?.tcg)?.cards),
    recipes: size(items?.recipes),
    blueprints: size(items?.blueprints),
    hangouts,
    livingBeings: size(record(items?.archive)?.livingBeings),
    quests: finished && new Set(finished.filter((id): id is number => typeof id === "number")),
  }
}

export function parseAccount(value: unknown): Account {
  const raw = record(value) ?? {}
  const info = characterInfo(raw.gi_characters)
  return {
    player: player(raw.gi_player),
    maxFriendship: record(raw.gi_characters)
      ? [...info.values()].filter(c => c.friendship === 10).length
      : undefined,
    achievements: achievements(raw),
    anecdotes: anecdotes(raw.gi_anecdotes),
    tasks: tasks(raw.gi_tasks, num(record(raw.gi_player)?.resin), bestComfort(raw.gi_teapot)),
    exploration: exploration(raw.gi_exploration),
    endgame: endgame(raw.gi_endgame),
    collections: collections(raw),
    characters: characters(raw.characters),
    weapons: weapons(raw.weapons),
    artifacts: artifacts(raw.artifacts),
    materials: materials(raw.materials),
    characterInfo: info,
    traveler: num(raw.mg_traveler),
  }
}
