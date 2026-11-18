// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

/** Whether the window is shown, as the page is told: not minimized or in the tray. */
export function useVisible() {
  return useSyncExternalStore(subscribe, () => !document.hidden)
}
