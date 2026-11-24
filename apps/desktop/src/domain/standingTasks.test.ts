// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account, Tasks } from "./account"
import { type StandingTask, standing } from "./standingTasks"

/** A moment given in China time (UTC+8). */
const cst = (month: number, day: number, hour: number, minute = 0) =>
  Date.UTC(2026, month - 1, day, hour - 8, minute)

/** An account with only the given parts. Every value is made up. */
const account = (parts: Partial<Account> = {}): Account => ({
  characters: [],
  weapons: [],
  artifacts: [],
  materials: new Map(),
  characterInfo: new Map(),
  ...parts,
})
const withTasks = (tasks: Tasks, parts: Partial<Account> = {}) => account({ tasks, ...parts })

/** Friday 2026-11-20, 12:00. */
const NOW = cst(11, 20, 12)

const judge = (task: StandingTask, source: Account, now = NOW) => standing(task, source, now)

describe("the to-do card's standing tasks", () => {
  it("leaves the battle pass and reputation to the player, with the weekly reset", () => {
    for (const task of ["battlePass", "reputation"] as const) {
      expect(judge(task, account())).toMatchObject({
        period: "weekly",
        auto: "manual",
        endsAt: cst(11, 23, 4),
      })
    }
  })

  it("counts the shop done once every Fate with a limit is bought out this month", () => {
    const bargains = (at: number, bought: number) => ({
      at,
      fates: [
        { item: "FakeFate", currency: "FakeDust", bought, limit: 5 },
        { item: "FakeFate", currency: "FakeGlitter", bought: 0 },
      ],
    })
    const full = judge("shop", withTasks({ bargains: bargains(cst(11, 2, 12), 5) }))
    expect(full).toMatchObject({ period: "monthly", auto: "done", endsAt: cst(12, 1, 4) })
    expect(full.detail).toEqual({
      task: "shop",
      fates: [{ item: "FakeFate", bought: 5, limit: 5 }],
    })
    const partly = judge("shop", withTasks({ bargains: bargains(cst(11, 2, 12), 3) }))
    expect(partly.auto).toBe("notDone")
    // Counts from last month do not carry over, however recent the snapshot.
    const old = judge("shop", withTasks({ bargains: bargains(cst(10, 30, 12), 5) }))
    expect(old.auto).toBe("notDone")
    expect(old.detail).toMatchObject({ fates: [{ bought: 0 }] })
    const unlimited = withTasks({ bargains: { at: cst(11, 2, 12), fates: [] } })
    expect(judge("shop", unlimited).auto).toBe("notRead")
  })

  it("counts the rank rewards left to claim up to the player's rank", () => {
    const ranks = (to: number) => Array.from({ length: to - 1 }, (_, i) => i + 2)
    const all = withTasks({ arRewards: ranks(45) }, { player: { ar: 45 } })
    expect(judge("arRewards", all)).toMatchObject({ auto: "done", period: "none" })
    const some = withTasks({ arRewards: [2, 3, 5] }, { player: { ar: 6 } })
    expect(judge("arRewards", some).detail).toEqual({ task: "arRewards", claimable: 2 })
    const capped = withTasks({ arRewards: ranks(60) }, { player: { ar: 65 } })
    expect(judge("arRewards", capped).auto).toBe("done")
    expect(judge("arRewards", withTasks({ arRewards: [] })).auto).toBe("notRead")
  })
})
