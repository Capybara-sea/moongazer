// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The parts of a Leyline export the pages show, read from the JSON
 * the backend hands over. Leyline leaves out whatever Capture did not see, so
 * every `gi_*` part is optional and a malformed field reads as missing.
 * Times are converted from unix seconds to milliseconds.
 */

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
  realm?: { value: number; limit: number }
  weeklyBosses?: { left: number; limit: number }
  expeditions?: { character?: string; doneAt: number }[]
  transformer?: { usedAt: number; readyAt: number }
  welkin?: { days: number }
  abyss?: { start: number; end: number; stars: number; maxStars: number }
}

export type Anecdotes = {
  recorded: number
  inProgress: number
  areas: number
  reward?: { index: number; progress: number; target: number }
  lastWish?: number
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
}

export type Account = {
  player?: Player
  /** Characters at friendship 10. */
  maxFriendship?: number
  achievements?: number
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

function tasks(value: unknown): Tasks | undefined {
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
    resin: resin && { value: count(resin.value), nextAt: ms(resin.nextAt) },
    commissions: commissions && {
      finished: count(commissions.finished),
      total: count(commissions.total),
      claimed: commissions.claimed === true,
    },
    realm: realm && { value: count(realm.value), limit: count(realm.limit) },
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
  let recorded = 0
  let inProgress = 0
  for (const entry of Object.values(record(raw.anecdotes) ?? {})) {
    const state = num(record(entry)?.state)
    // As Capture counts them: recorded once, even if it is running again now.
    if (state === 3 || count(record(entry)?.finishCount) > 0) recorded++
    else if (state === 2) inProgress++
  }
  const reward = record(raw.reward)
  return {
    recorded,
    inProgress,
    areas: list(raw.unlockedAreas)?.length ?? 0,
    reward: reward && {
      index: count(reward.index),
      progress: count(reward.progress),
      target: count(reward.target),
    },
    lastWish: ms(record(raw.wish)?.lastWishTime),
  }
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
  return {
    outfits: size(record(wardrobe?.outfits)?.owned),
    gliders: size(record(wardrobe?.gliders)?.owned),
    tcgCards: size(record(items?.tcg)?.cards),
    recipes: size(items?.recipes),
    blueprints: size(items?.blueprints),
    hangouts,
    livingBeings: size(record(items?.archive)?.livingBeings),
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
    achievements: list(raw.gi_achievements)?.length,
    anecdotes: anecdotes(raw.gi_anecdotes),
    tasks: tasks(raw.gi_tasks),
    exploration: exploration(raw.gi_exploration),
    endgame: endgame(raw.gi_endgame),
    collections: collections(raw),
    characters: characters(raw.characters),
    weapons: weapons(raw.weapons),
    artifacts: artifacts(raw.artifacts),
    materials: materials(raw.materials),
    characterInfo: info,
  }
}
