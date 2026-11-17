// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import type { Element } from "@/domain/elements"

export type CharacterSort = "level" | "rarity" | "constellation"
export type CharacterView = "cards" | "list"

/**
 * How the character list is filtered, sorted and shown. The detail page's
 * avatar column and its previous and next buttons follow the same order.
 */
type CharacterListState = {
  /** null shows every element. */
  element: Element | null
  query: string
  sort: CharacterSort
  view: CharacterView
  setElement: (element: Element | null) => void
  setQuery: (query: string) => void
  setSort: (sort: CharacterSort) => void
  setView: (view: CharacterView) => void
}

export const useCharacterListStore = create<CharacterListState>(set => ({
  element: null,
  query: "",
  sort: "level",
  view: "cards",
  setElement: element => set({ element }),
  setQuery: query => set({ query }),
  setSort: sort => set({ sort }),
  setView: view => set({ view }),
}))
