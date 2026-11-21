// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"

/** How the anecdotes page is filtered; it opens on what is left to do. */
type AnecdoteListState = {
  onlyTodo: boolean
  onlyHidden: boolean
  /** An area id, or null for every area. */
  area: number | null
  /** A character's key, or null for every character. */
  character: string | null
  query: string
  setOnlyTodo: (onlyTodo: boolean) => void
  setOnlyHidden: (onlyHidden: boolean) => void
  setArea: (area: number | null) => void
  setCharacter: (character: string | null) => void
  setQuery: (query: string) => void
}

export const useAnecdoteListStore = create<AnecdoteListState>(set => ({
  onlyTodo: true,
  onlyHidden: false,
  area: null,
  character: null,
  query: "",
  setOnlyTodo: onlyTodo => set({ onlyTodo }),
  setOnlyHidden: onlyHidden => set({ onlyHidden }),
  setArea: area => set({ area }),
  setCharacter: character => set({ character }),
  setQuery: query => set({ query }),
}))
