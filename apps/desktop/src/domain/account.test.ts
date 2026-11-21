// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { parseAccount } from "./account"

/** Parses a Leyline export with only the given `gi_*` parts. Every value is made up. */
const leyline = (parts: Record<string, unknown>) =>
  parseAccount({ format: "GOOD", version: 3, leyline: 1, ...parts })

describe("parseAccount on a Leyline export", () => {
  it("reads the player with the profile picture, frame, name card and birthday", () => {
    const { player } = leyline({
      gi_player: {
        uid: 123456789,
        ar: 60,
        wl: 9,
        nickname: "Fake Tester",
        signature: "",
        nameCard: 5,
        profilePicture: { id: 7, frameId: 2 },
        birthday: { month: 1, day: 2 },
      },
    })
    expect(player?.profileFrame).toBe(2)
    expect(player?.nameCard).toBe(5)
    expect(player?.uid).toBe(123456789)
    expect(player?.ar).toBe(60)
    expect(player?.wl).toBe(9)
    expect(player?.nickname).toBe("Fake Tester")
    expect(player?.signature).toBe("")
    expect(player?.profilePicture).toBe(7)
    expect(player?.birthday).toEqual({ month: 1, day: 2 })
  })

  it("has no profile picture when an older client sends only the character", () => {
    const { player } = leyline({ gi_player: { profilePicture: { avatarId: 10000001 } } })
    expect(player?.profilePicture).toBeUndefined()
    expect(player?.birthday).toBeUndefined()
  })

  it("counts the characters at friendship 10 and the achievements", () => {
    const account = leyline({
      gi_characters: {
        FakeOne: { friendship: 10, exp: 0 },
        FakeTwo: { friendship: 10 },
        FakeThree: { friendship: 9 },
        FakeTraveler: {},
      },
      gi_achievements: [1, 2, 3],
    })
    expect(account.maxFriendship).toBe(2)
    expect(account.achievements?.done.size).toBe(3)
    expect(leyline({ gi_characters: {} }).maxFriendship).toBe(0)
  })

  it("reads the achievements with their times and the unfinished ones' counts", () => {
    const { achievements } = leyline({
      gi_achievements: [1, 2, "3"],
      gi_achievement_times: { 1: 1_000 },
      gi_achievement_progress: { 4: { progress: 3, total: 10 }, 5: { total: 1 }, x: {} },
    })
    expect([...(achievements?.done ?? [])]).toEqual([
      [1, 1_000_000],
      [2, undefined],
    ])
    expect([...(achievements?.progress ?? [])]).toEqual([
      [4, { current: 3, total: 10 }],
      [5, { current: 0, total: 1 }],
    ])
    expect(leyline({ gi_achievements: [] }).achievements?.progress).toBeNull()
  })

  it("reads each anecdote's state, the unlocked areas, the seals and the last wish", () => {
    const { anecdotes } = leyline({
      gi_anecdotes: {
        anecdotes: { 1: { state: 3, finishCount: 1 }, 2: { state: 2 }, x: { state: 3 } },
        unlockedAreas: [1, 2, "3"],
        reward: { index: 2, progress: 5 },
        wish: { lastWishTime: 1_000 },
      },
    })
    expect([...(anecdotes?.entries ?? [])]).toEqual([
      [1, { state: 3, finishCount: 1 }],
      [2, { state: 2, finishCount: 0 }],
    ])
    expect([...(anecdotes?.unlockedAreas ?? [])]).toEqual([1, 2])
    expect(anecdotes?.reward).toEqual({ index: 2, progress: 5, target: 0 })
    expect(anecdotes?.lastWish).toBe(1_000_000)
  })

  it("reads the tasks with their times in milliseconds", () => {
    const { tasks } = leyline({
      gi_tasks: {
        resin: { value: 120, nextAt: 1_000 },
        commissions: { finished: 3, total: 4, claimed: true },
        realm: { value: 1_200, limit: 2_400 },
        weeklyBosses: { left: 2, used: 1, limit: 3, cost: 30, fullCost: 60 },
        expeditions: [
          { character: "FakeOne", id: 1, start: 0, hours: 20, doneAt: 2_000 },
          { id: 2, start: 0, hours: 20, doneAt: 3_000 },
          { character: "FakeTwo", id: 3 },
        ],
        transformer: { usedAt: 4_000, readyAt: 5_000 },
        welkin: { days: 12 },
        abyss: { start: 6_000, end: 7_000, stars: 27, maxStars: 36 },
      },
    })
    expect(tasks?.resin).toEqual({ value: 120, nextAt: 1_000_000 })
    expect(tasks?.commissions).toEqual({ finished: 3, total: 4, claimed: true })
    expect(tasks?.realm).toEqual({ value: 1_200, limit: 2_400 })
    expect(tasks?.weeklyBosses).toEqual({ left: 2, limit: 3 })
    expect(tasks?.expeditions?.map(item => item.doneAt)).toEqual([2_000_000, 3_000_000])
    expect(tasks?.expeditions?.map(item => item.character)).toEqual(["FakeOne", undefined])
    expect(tasks?.transformer).toEqual({ usedAt: 4_000_000, readyAt: 5_000_000 })
    expect(tasks?.welkin?.days).toBe(12)
    expect(tasks?.abyss).toEqual({ start: 6_000_000, end: 7_000_000, stars: 27, maxStars: 36 })
  })

  it("reads missing zero counts in the tasks as 0", () => {
    const { tasks } = leyline({
      gi_tasks: {
        resin: { value: 210 },
        commissions: { total: 4 },
        weeklyBosses: { limit: 3 },
        welkin: {},
        abyss: { start: 6_000, end: 7_000, maxStars: 36 },
      },
    })
    expect(tasks?.resin?.value).toBe(210)
    expect(tasks?.resin?.nextAt).toBeUndefined()
    expect(tasks?.commissions).toEqual({ finished: 0, total: 4, claimed: false })
    expect(tasks?.weeklyBosses?.left).toBe(0)
    expect(tasks?.welkin?.days).toBe(0)
    expect(tasks?.abyss?.stars).toBe(0)
    expect(tasks?.realm).toBeUndefined()
    expect(tasks?.expeditions).toBeUndefined()
  })

  it("needs both times for the transformer and the abyss", () => {
    const { tasks } = leyline({
      gi_tasks: { transformer: { usedAt: 4_000 }, abyss: { end: 7_000, stars: 27 } },
    })
    expect(tasks?.transformer).toBeUndefined()
    expect(tasks?.abyss).toBeUndefined()
  })

  it("reads the exploration maps by numeric id", () => {
    const { exploration } = leyline({
      gi_exploration: {
        statues: { 1: { level: 10, oculi: 0 }, 2: { level: 1, oculi: 3 } },
        offerings: { 1: 12, 2: 0 },
        reputation: { 1: 8 },
        explore: { 101: 1_000, 102: 30 },
      },
    })
    expect(exploration?.statues.get(1)).toBe(10)
    expect(exploration?.statues.get(2)).toBe(1)
    expect(exploration?.offerings.get(1)).toBe(12)
    expect(exploration?.offerings.get(2)).toBe(0)
    expect(exploration?.reputation.get(1)).toBe(8)
    expect(exploration?.explore?.get(101)).toBe(1_000)
    expect(exploration?.explore?.size).toBe(2)
  })

  it("has no exploration points in co-op", () => {
    const { exploration } = leyline({ gi_exploration: { reputation: { 1: 8 } } })
    expect(exploration?.explore).toBeUndefined()
    expect(exploration?.statues.size).toBe(0)
    expect(exploration?.offerings.size).toBe(0)
  })

  it("reads the theater, the Stygian records and the abyss periods' picks", () => {
    const fights = [
      { time: 95, done: true, team: ["FakeOne", "FakeTwo"] },
      { done: false, team: ["FakeThree"] },
    ]
    const picked = [
      { key: "FakeOne", times: 9 },
      { key: "FakeTwo", times: 4 },
    ]
    const { endgame } = leyline({
      gi_endgame: {
        theater: {
          season: 30,
          difficulty: 4,
          level: 4,
          acts: 3,
          stars: 2,
          maxStars: 10,
          starredActs: [1, 3],
        },
        stygian: { records: [{ season: 501, difficulty: 6, at: 8_000, coop: false, fights }] },
        abyss: { periods: [{ season: 120, floor: 12, chamber: 3, stars: 36, picked }] },
      },
    })
    expect(endgame?.theater).toEqual({
      season: 30,
      level: 4,
      acts: 3,
      stars: 2,
      maxStars: 10,
      starredActs: [1, 3],
    })
    const record = endgame?.stygian?.[0]
    expect(record?.season).toBe(501)
    expect(record?.difficulty).toBe(6)
    expect(record?.at).toBe(8_000_000)
    expect(record?.fights[0]).toEqual({ time: 95, done: true, team: ["FakeOne", "FakeTwo"] })
    expect(record?.fights[1]).toEqual({ time: 0, done: false, team: ["FakeThree"] })
    const period = endgame?.abyss?.[0]
    expect(period?.season).toBe(120)
    expect(period?.floor).toBe(12)
    expect(period?.chamber).toBe(3)
    expect(period?.picked).toEqual(["FakeOne", "FakeTwo"])
  })

  it("skips a theater, record or period without its season or time", () => {
    const { endgame } = leyline({
      gi_endgame: {
        theater: { acts: 3 },
        stygian: {
          records: [
            { difficulty: 6, at: 8_000, fights: [] },
            { season: 502, difficulty: 3, fights: [] },
            { season: 503, at: 9_000 },
          ],
        },
        abyss: { periods: [{ floor: 12 }, { season: 121, picked: [{ times: 2 }] }] },
      },
    })
    expect(endgame?.theater).toBeUndefined()
    expect(endgame?.stygian?.map(record => record.season)).toEqual([503])
    expect(endgame?.stygian?.[0]?.difficulty).toBe(0)
    expect(endgame?.stygian?.[0]?.fights.length).toBe(0)
    expect(endgame?.abyss?.map(period => period.season)).toEqual([121])
    expect(endgame?.abyss?.[0]?.floor).toBe(0)
    expect(endgame?.abyss?.[0]?.picked.length).toBe(0)
    expect(leyline({ gi_endgame: { theater: { season: 30 } } }).endgame?.stygian).toBeUndefined()
  })

  it("counts the collections and the hangout endings claimed of all", () => {
    const { collections } = leyline({
      gi_collections: {
        tcg: { cards: { 1101: { count: 1 }, 1102: { count: 1 }, 311101: { count: 2 } } },
        recipes: { 1: 100, 2: 0 },
        blueprints: [1, 2, 3, 4],
        hangouts: {
          101401: { endings: { 1: "claimed", 2: "claimed", 3: "unclaimed" }, pictures: [] },
          101402: { endings: { 4: "locked", 5: "claimed" }, pictures: [] },
        },
        archive: { livingBeings: [1, 2, 3, 4, 5] },
        quests: { finished: [6020, 76117], active: [6021] },
      },
      gi_wardrobe: { outfits: { owned: [1, 2] }, gliders: { owned: [1, 2, 3] } },
    })
    expect(collections?.quests).toEqual(new Set([6020, 76117]))
    expect(collections?.tcgCards).toBe(3)
    expect(collections?.recipes).toBe(2)
    expect(collections?.blueprints).toBe(4)
    expect(collections?.hangouts).toEqual({ claimed: 3, total: 5 })
    expect(collections?.livingBeings).toBe(5)
    expect(collections?.outfits).toBe(2)
    expect(collections?.gliders).toBe(3)
  })

  it("reads the collections from the wardrobe alone", () => {
    const { collections } = leyline({ gi_wardrobe: { outfits: { owned: [1] } } })
    expect(collections?.outfits).toBe(1)
    expect(collections?.gliders).toBeUndefined()
    expect(collections?.quests).toBeUndefined()
    expect(collections?.hangouts).toBeUndefined()
    expect(collections?.recipes).toBeUndefined()
  })
})

describe("parseAccount on other input", () => {
  it("reads every part an export leaves out as missing", () => {
    const account = leyline({ characters: [], materials: {} })
    expect(account.player).toBeUndefined()
    expect(account.maxFriendship).toBeUndefined()
    expect(account.achievements).toBeUndefined()
    expect(account.anecdotes).toBeUndefined()
    expect(account.tasks).toBeUndefined()
    expect(account.exploration).toBeUndefined()
    expect(account.endgame).toBeUndefined()
    expect(account.collections).toBeUndefined()
    expect(account.materials.size).toBe(0)
  })

  it("reads the material counts", () => {
    expect(leyline({ materials: { FakeOre: 3 } }).materials.get("FakeOre")).toBe(3)
  })
})
