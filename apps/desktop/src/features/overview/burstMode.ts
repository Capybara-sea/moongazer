// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"
import { BURST_MODES, type BurstMode } from "@/domain/resinPlan"
import { readStored, writeStored } from "@/lib/storage"

const KEY = "moongazer:resinPlan:burstMode"

/** How the resin plan spends resin during the burst, saved in this browser; all by default. */
export function useBurstMode() {
  const [mode, setMode] = useState<BurstMode>(
    () => BURST_MODES.find(m => m === readStored(KEY)) ?? "all",
  )
  const change = (next: BurstMode) => {
    setMode(next)
    writeStored(KEY, next)
  }
  return [mode, change] as const
}
