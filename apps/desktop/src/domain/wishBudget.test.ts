// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { parseAccount } from "./account"
import { budgetWishes, wishBudget } from "./wishBudget"

const NOW = Date.UTC(2026, 10, 20, 4)

/** A made-up export with a bag and, optionally, Paimon's Bargains read at `at` (Unix seconds). */
function account(at?: number) {
  return parseAccount({
    format: "GOOD",
    version: 3,
    leyline: 1,
    materials: {
      IntertwinedFate: 23,
      Primogem: 12_480,
      GenesisCrystal: 300,
      MasterlessStarglitter: 61,
      MasterlessStardust: 1_450,
      AcquaintFate: 11,
    },
    ...(at === undefined
      ? {}
      : {
          gi_tasks: {
            bargains: {
              at,
              fates: [
                {
                  item: "IntertwinedFate",
                  currency: "MasterlessStardust",
                  cost: 75,
                  bought: 2,
                  limit: 5,
                },
              ],
            },
          },
        }),
  })
}

describe("wish budget", () => {
  it("counts each currency's wishes, Genesis Crystals with the Primogems", () => {
    const budget = wishBudget(account(NOW / 1000 - 86_400), NOW)
    expect(budget.stardustLeft).toBe(3)
    expect(budget.stardustRead).toBe(true)
    expect(budgetWishes(budget, false)).toEqual({
      fates: 23,
      primogems: 78,
      genesis: 0,
      starglitter: 12,
      stardust: 3,
      total: 116,
    })
    expect(budgetWishes(budget, true).genesis).toBe(1)
    expect(budgetWishes(budget, true).total).toBe(117)
  })

  it("takes last month's purchases as none, and an unread shop as five left", () => {
    const old = wishBudget(account(Date.UTC(2026, 8, 1) / 1000), NOW)
    expect(old.stardustLeft).toBe(5)
    const unread = wishBudget(account(), NOW)
    expect(unread.stardustLeft).toBe(5)
    expect(unread.stardustRead).toBe(false)
  })

  it("is nothing without an account", () => {
    expect(budgetWishes(wishBudget(undefined, NOW), true).total).toBe(0)
  })
})
