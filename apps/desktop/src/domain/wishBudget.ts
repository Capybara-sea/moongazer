// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * What the account's bag buys in event wishes: fates, Primogems (160 a wish),
 * Genesis Crystals if counted, and fates from Paimon's Bargains (Masterless
 * Starglitter 5 a fate; Stardust 75 a fate, at most 5 a month).
 */

import type { Account } from "@/domain/account"
import { lastMonthlyReset } from "@/domain/gameTime"
import { characterData } from "@/domain/names"

const PRIMOGEMS_PER_WISH = 160
const STARGLITTER_PER_FATE = 5
const STARDUST_PER_FATE = 75
const STARDUST_FATES_A_MONTH = 5

export type Budget = {
  fates: number
  primogems: number
  genesis: number
  starglitter: number
  stardust: number
  acquaint: number
  /** Fates Stardust still buys this month; `stardustRead` when the shop said how many were bought. */
  stardustLeft: number
  stardustRead: boolean
  /** The account's four-star characters, and how many of them are at C6. */
  fourStars: number
  maxed: number
}

/** The bag's wish currencies as of the account's snapshot; all 0 without one. */
export function wishBudget(account: Account | undefined, now: number): Budget {
  const has = (key: string) => account?.materials.get(key) ?? 0
  const shop = account?.tasks?.bargains
  const thisMonth = shop !== undefined && shop.at >= lastMonthlyReset(now)
  const dust = shop?.fates.find(
    fate => fate.item === "IntertwinedFate" && fate.currency === "MasterlessStardust",
  )
  const limit = dust?.limit ?? STARDUST_FATES_A_MONTH
  const bought = dust && thisMonth ? dust.bought : 0
  const fours = (account?.characters ?? []).filter(c => characterData(c.key).rarity === 4)
  return {
    fates: has("IntertwinedFate"),
    primogems: has("Primogem"),
    genesis: has("GenesisCrystal"),
    starglitter: has("MasterlessStarglitter"),
    stardust: has("MasterlessStardust"),
    acquaint: has("AcquaintFate"),
    stardustLeft: Math.max(0, limit - bought),
    stardustRead: dust !== undefined,
    fourStars: fours.length,
    maxed: fours.filter(c => c.constellation >= 6).length,
  }
}

/** Each currency's wishes, the Genesis Crystals counted with the Primogems when asked. */
export function budgetWishes(budget: Budget, genesis: boolean) {
  const primogems = Math.floor(budget.primogems / PRIMOGEMS_PER_WISH)
  const withGenesis = Math.floor((budget.primogems + budget.genesis) / PRIMOGEMS_PER_WISH)
  const parts = {
    fates: budget.fates,
    primogems,
    genesis: genesis ? withGenesis - primogems : 0,
    starglitter: Math.floor(budget.starglitter / STARGLITTER_PER_FATE),
    stardust: Math.min(Math.floor(budget.stardust / STARDUST_PER_FATE), budget.stardustLeft),
  }
  return { ...parts, total: Object.values(parts).reduce((sum, n) => sum + n, 0) }
}
