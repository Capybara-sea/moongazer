// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"

export type FurnishingListView = "sets" | "characters" | "furnishings"
export type SpincrystalFilter = "all" | "placed" | "bag" | "none"

/** How the furnishing sets and spincrystals pages are filtered, kept while other pages show. */
type RealmListState = {
  view: FurnishingListView
  query: string
  /** The furnishings view lists only what the bag lacks. */
  onlyShort: boolean
  /** The set row opened, by suite id. */
  open: number | null
  /** A spincrystal area id, or null for every area. */
  area: number | null
  filter: SpincrystalFilter
  setView: (view: FurnishingListView) => void
  setQuery: (query: string) => void
  setOnlyShort: (onlyShort: boolean) => void
  setOpen: (open: number | null) => void
  setArea: (area: number | null) => void
  setFilter: (filter: SpincrystalFilter) => void
}

export const useRealmListStore = create<RealmListState>(set => ({
  view: "sets",
  query: "",
  onlyShort: true,
  open: null,
  area: null,
  filter: "all",
  setView: view => set({ view }),
  setQuery: query => set({ query }),
  setOnlyShort: onlyShort => set({ onlyShort }),
  setOpen: open => set({ open }),
  setArea: area => set({ area }),
  setFilter: filter => set({ filter }),
}))
