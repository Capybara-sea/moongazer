// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import type { WeaponType } from "@/domain/elements"

export type WeaponSort = "rarity" | "level" | "refinement"
export type WeaponView = "table" | "cards"

/** How the weapons are shown, filtered and sorted. */
type WeaponListState = {
  /** null shows every type. */
  type: WeaponType | null
  onlyFree: boolean
  sort: WeaponSort
  view: WeaponView
  setType: (type: WeaponType | null) => void
  setOnlyFree: (onlyFree: boolean) => void
  setSort: (sort: WeaponSort) => void
  setView: (view: WeaponView) => void
}

export const useWeaponListStore = create<WeaponListState>(set => ({
  type: null,
  onlyFree: false,
  sort: "rarity",
  view: "table",
  setType: type => set({ type }),
  setOnlyFree: onlyFree => set({ onlyFree }),
  setSort: sort => set({ sort }),
  setView: view => set({ view }),
}))
