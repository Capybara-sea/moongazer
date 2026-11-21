// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import type { AchievementFilter } from "@/domain/achievements"
import { readStored, writeStored } from "@/lib/storage"

const SHOW_HIDDEN_KEY = "moongazer:achievements:showHidden"

/** How the achievements page is filtered; whether hidden descriptions show is remembered. */
type AchievementListState = {
  /** A goal id, or null for every goal. */
  goal: number | null
  filter: AchievementFilter
  query: string
  showHidden: boolean
  setGoal: (goal: number | null) => void
  setFilter: (filter: AchievementFilter) => void
  setQuery: (query: string) => void
  setShowHidden: (showHidden: boolean) => void
}

export const useAchievementListStore = create<AchievementListState>(set => ({
  goal: null,
  filter: "all",
  query: "",
  showHidden: readStored(SHOW_HIDDEN_KEY) === "on",
  setGoal: goal => set({ goal }),
  setFilter: filter => set({ filter }),
  setQuery: query => set({ query }),
  setShowHidden: showHidden => {
    writeStored(SHOW_HIDDEN_KEY, showHidden ? "on" : "off")
    set({ showHidden })
  },
}))
