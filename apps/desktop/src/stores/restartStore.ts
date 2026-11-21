// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import { useCaptureStore } from "@/stores/captureStore"

/** A restart that waits for the user's yes in app/RestartDialog. */
export type RestartRequest = {
  title: string
  /** Paragraphs above the auto sync warning. */
  body: string[]
  run: () => Promise<void>
}

type RestartState = {
  pending: RestartRequest | null
  /**
   * Restarts after asking: always, or only while auto sync is connected,
   * since a restart cuts it off from the game until the next login.
   */
  ask: (request: RestartRequest, always: boolean) => Promise<void>
  answer: (restart: boolean) => Promise<void>
}

export function syncConnected() {
  return useCaptureStore.getState().status?.phase === "connected"
}

export const useRestartStore = create<RestartState>((set, get) => ({
  pending: null,

  async ask(request, always) {
    if (always || syncConnected()) set({ pending: request })
    else await request.run()
  },

  async answer(restart) {
    const request = get().pending
    set({ pending: null })
    if (restart && request) await request.run()
  },
}))
