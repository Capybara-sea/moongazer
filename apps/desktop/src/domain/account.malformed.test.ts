// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { parseAccount } from "./account"

/** Parses a Leyline export with only the given `gi_*` parts. Every value is made up. */
const leyline = (parts: Record<string, unknown>) =>
  parseAccount({ format: "GOOD", version: 3, leyline: 1, ...parts })

describe("parseAccount on malformed input", () => {
  it("reads anything but an object as an empty export", () => {
    for (const value of [null, undefined, "GOOD", 42, [{ gi_player: {} }]]) {
      expect(parseAccount(value).characters).toEqual([])
      expect(parseAccount(value).player).toBeUndefined()
    }
  })

  it("reads player, friendship, achievement and anecdote fields of a wrong type as missing", () => {
    const account = leyline({
      gi_player: {
        uid: "123",
        ar: null,
        nickname: 5,
        nameCard: "5",
        profilePicture: [7],
        birthday: { month: "1" },
      },
      gi_characters: [{ friendship: 10 }],
      gi_achievements: { 1: true },
      gi_anecdotes: { anecdotes: [{ state: 3 }], unlockedAreas: {}, reward: [], wish: "x" },
    })
    expect(account.player?.uid).toBeUndefined()
    expect(account.player?.ar).toBeUndefined()
    expect(account.player?.nickname).toBeUndefined()
    expect(account.player?.profilePicture).toBeUndefined()
    expect(account.player?.profileFrame).toBeUndefined()
    expect(account.player?.nameCard).toBeUndefined()
    expect(account.player?.birthday).toBeUndefined()
    expect(account.maxFriendship).toBeUndefined()
    expect(account.achievements).toBeUndefined()
    expect(account.anecdotes?.entries.size).toBe(0)
    expect(account.anecdotes?.reward).toBeUndefined()
    expect(account.anecdotes?.lastWish).toBeUndefined()
    const friends = leyline({ gi_characters: { A: null, B: "10", C: { friendship: "10" } } })
    expect(friends.maxFriendship).toBe(0)
  })

  it("reads task fields of the wrong type as missing", () => {
    const { tasks } = leyline({
      gi_tasks: {
        resin: [],
        commissions: "4/4",
        realm: null,
        weeklyBosses: { left: "2", used: 1, limit: 3 },
        expeditions: { 1: { doneAt: 2_000 } },
        transformer: { usedAt: "4000", readyAt: 5_000 },
        welkin: 12,
        abyss: { start: 6_000, end: null },
      },
    })
    expect(tasks?.resin).toBeUndefined()
    expect(tasks?.commissions).toBeUndefined()
    expect(tasks?.realm).toBeUndefined()
    expect(tasks?.weeklyBosses?.left).toBe(0)
    expect(tasks?.expeditions).toBeUndefined()
    expect(tasks?.transformer).toBeUndefined()
    expect(tasks?.welkin).toBeUndefined()
    expect(tasks?.abyss).toBeUndefined()
    expect(leyline({ gi_tasks: "none" }).tasks).toBeUndefined()
    const realm = { value: 1_200, limit: 2_400 }
    for (const gi_teapot of [null, "comfort", { comfort: [] }, { comfort: { 1: 5_000 } }]) {
      expect(leyline({ gi_tasks: { realm }, gi_teapot }).tasks?.realm?.comfort).toBeUndefined()
    }
    const odd = { comfort: { 1: { mansion: "9000", blocks: [2_000, "x", null] }, 2: null } }
    expect(leyline({ gi_tasks: { realm }, gi_teapot: odd }).tasks?.realm?.comfort).toBe(2_000)
  })

  it("reads exploration, endgame and collection fields of the wrong type as missing", () => {
    const account = leyline({
      gi_exploration: { statues: [], offerings: null, reputation: { 1: "8", 2: 4 }, explore: [] },
      gi_endgame: { theater: { season: "30" }, stygian: { records: {} }, abyss: [] },
      gi_collections: { tcg: { cards: "many" }, recipes: 5, blueprints: null, hangouts: [] },
      gi_wardrobe: "none",
    })
    expect(account.exploration?.statues.size).toBe(0)
    expect(account.exploration?.offerings.size).toBe(0)
    expect(account.exploration?.reputation.size).toBe(1)
    expect(account.exploration?.reputation.get(2)).toBe(4)
    expect(account.exploration?.explore).toBeUndefined()
    expect(account.endgame?.theater).toBeUndefined()
    expect(account.endgame?.stygian).toBeUndefined()
    expect(account.endgame?.abyss).toBeUndefined()
    const acts = leyline({
      gi_endgame: { theater: { season: 30, starredActs: [1, "2", null, 4] } },
    })
    expect(acts.endgame?.theater?.starredActs).toEqual([1, 4])
    const noActs = leyline({ gi_endgame: { theater: { season: 30, starredActs: { 1: true } } } })
    expect(noActs.endgame?.theater?.starredActs).toBeUndefined()
    expect(account.collections?.tcgCards).toBeUndefined()
    expect(account.collections?.recipes).toBeUndefined()
    expect(account.collections?.blueprints).toBeUndefined()
    expect(account.collections?.hangouts).toBeUndefined()
    expect(account.collections?.outfits).toBeUndefined()
    expect(leyline({ gi_collections: [], gi_wardrobe: "none" }).collections).toBeUndefined()
  })
})
