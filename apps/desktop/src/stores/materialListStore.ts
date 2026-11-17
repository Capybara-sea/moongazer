// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import type { MaterialTab } from "@/domain/names"

/** How the materials page is filtered, and which of its tabs shows. */
type MaterialListState = {
  onlyChanged: boolean
  query: string
  tab: MaterialTab
  setOnlyChanged: (onlyChanged: boolean) => void
  setQuery: (query: string) => void
  setTab: (tab: MaterialTab) => void
}

export const useMaterialListStore = create<MaterialListState>(set => ({
  onlyChanged: false,
  query: "",
  tab: "develop",
  setOnlyChanged: onlyChanged => set({ onlyChanged }),
  setQuery: query => set({ query }),
  setTab: tab => set({ tab }),
}))
