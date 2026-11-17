// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import type { SlotKey } from "@/domain/good"

/** How the artifact cards are filtered. */
type ArtifactListState = {
  /** null shows every slot. */
  slot: SlotKey | null
  /** A set key; null shows every set. */
  set: string | null
  onlyFree: boolean
  setSlot: (slot: SlotKey | null) => void
  setSet: (set: string | null) => void
  setOnlyFree: (onlyFree: boolean) => void
}

export const useArtifactListStore = create<ArtifactListState>(update => ({
  slot: null,
  set: null,
  onlyFree: false,
  setSlot: slot => update({ slot }),
  setSet: set => update({ set }),
  setOnlyFree: onlyFree => update({ onlyFree }),
}))
