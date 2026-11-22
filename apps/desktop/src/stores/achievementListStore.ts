// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import type { AchievementFilter, AchievementSort } from "@/domain/achievements"
import { readStored, writeStored } from "@/lib/storage"

const HIDE_HIDDEN_KEY = "moongazer:achievements:hideHidden"

/**
 * How the achievements page is filtered and sorted; whether unfinished hidden ones are left out
 * is remembered.
 */
type AchievementListState = {
  /** A goal id, or null for every goal. */
  goal: number | null
  filter: AchievementFilter
  query: string
  hideHidden: boolean
  sort: AchievementSort
  setGoal: (goal: number | null) => void
  setFilter: (filter: AchievementFilter) => void
  setQuery: (query: string) => void
  setHideHidden: (hideHidden: boolean) => void
  setSort: (sort: AchievementSort) => void
}

export const useAchievementListStore = create<AchievementListState>(set => ({
  goal: null,
  filter: "all",
  query: "",
  hideHidden: readStored(HIDE_HIDDEN_KEY) === "on",
  sort: "game",
  setGoal: goal => set({ goal }),
  setFilter: filter => set({ filter }),
  setQuery: query => set({ query }),
  setHideHidden: hideHidden => {
    writeStored(HIDE_HIDDEN_KEY, hideHidden ? "on" : "off")
    set({ hideHidden })
  },
  setSort: sort => set({ sort }),
}))
