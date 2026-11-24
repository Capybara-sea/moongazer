// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "./account"
import { burstFor, currentBurst, resinState } from "./resinPlan"

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

describe("the resin there is", () => {
  const now = cst(11, 24, 12)
  const training = { id: 5294, start: cst(11, 2, 4), end: cst(1, 25, 4) + 365 * 86_400_000 }

  it("lists the resin items held", () => {
    const state = resinState(
      account({
        materials: new Map([
          ["CondensedResin", 3],
          ["FragileResin", 0],
          ["TransientResin", 1],
        ]),
      }),
      now,
    )
    expect(state.items).toEqual([
      { key: "CondensedResin", count: 3 },
      { key: "TransientResin", count: 1 },
    ])
    expect(state.training).toBeUndefined()
  })

  it("counts the training event's resin spent today while it runs, none from an earlier day", () => {
    const today = account({
      events: [training],
      tasks: { resinSpent: { value: 60, at: cst(11, 24, 9) } },
    })
    expect(resinState(today, now).training).toEqual({ spent: 60, goal: 120 })
    const yesterday = account({
      events: [training],
      tasks: { resinSpent: { value: 60, at: cst(11, 24, 3) } },
    })
    expect(resinState(yesterday, now).training).toEqual({ spent: 0, goal: 120 })
  })
})

describe("the Stygian Onslaught burst", () => {
  it("runs from a season's start to 04:00 ten game days later", () => {
    const burst = currentBurst(cst(11, 15, 12))
    expect(burst).toEqual({ season: 5269013, start: cst(11, 11, 10), end: cst(11, 21, 4) })
    expect(currentBurst(cst(11, 21, 3, 59))?.season).toBe(5269013)
    expect(currentBurst(cst(11, 21, 4))).toBeUndefined()
    expect(currentBurst(cst(11, 11, 9, 59))).toBeUndefined()
  })

  it("counts the burst only from Adventure Rank 45", () => {
    const at = cst(11, 15, 12)
    expect(burstFor(account({ player: { ar: 45 } }), at)?.season).toBe(5269013)
    expect(burstFor(account({ player: { ar: 44 } }), at)).toBeUndefined()
    expect(burstFor(account(), at)).toBeUndefined()
  })

  it("knows no burst past the last season in the bundled data", () => {
    expect(currentBurst(Date.UTC(2030, 0, 10))).toBeUndefined()
  })
})
