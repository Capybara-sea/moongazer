// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The spincrystals page's data: the game's spincrystals from the table `cargo xtask gen-data`
 * builds, and which of them an account has placed in the realm or holds in its bag.
 */

import data from "@/generated/collection.json"
import type { Account } from "./account"

export type SpincrystalInfo = {
  id: number
  key: string
  label: string
  song?: string
  area: number
  hint?: string
}

type Table = { spincrystals: SpincrystalInfo[]; spincrystalAreas: Record<string, string> }

const table: Table = data

export const SPINCRYSTALS = table.spincrystals
export const SPINCRYSTAL_AREAS = Object.entries(table.spincrystalAreas).map(([id, name]) => ({
  id: Number(id),
  name,
}))

/** Placed in the realm, in the bag, or not had. */
export type SpincrystalStatus = "placed" | "bag" | "none"

export type SpincrystalView = {
  rows: { info: SpincrystalInfo; status: SpincrystalStatus }[]
  placed: number
  bag: number
  /** The realm's list was read; an account that has placed none has no list. */
  realmRead: boolean
}

export function spincrystalView(account: Account): SpincrystalView {
  const placed = account.collections?.spincrystals
  const rows = SPINCRYSTALS.map(info => ({
    info,
    status: (placed?.has(info.id)
      ? "placed"
      : (account.materials.get(info.key) ?? 0) > 0
        ? "bag"
        : "none") as SpincrystalStatus,
  }))
  return {
    rows,
    placed: rows.filter(r => r.status === "placed").length,
    bag: rows.filter(r => r.status === "bag").length,
    realmRead: placed !== undefined,
  }
}
