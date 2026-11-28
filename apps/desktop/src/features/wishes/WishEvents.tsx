// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect } from "react"
import { onWishProgress, onWishRead } from "@/lib/backend/wishes"
import { useWishStore } from "@/stores/wishStore"

/**
 * Takes the wish history reads' events, wherever the user is, so the side
 * panel shows a read under way, and reads the auto read setting. Renders nothing.
 */
export function WishEvents() {
  useEffect(() => {
    void useWishStore.getState().loadAutoRead()
    const listening = [
      onWishProgress(progress => useWishStore.getState().onProgress(progress)),
      onWishRead(end => useWishStore.getState().onRead(end)),
    ]
    return () => {
      for (const unlisten of listening) void unlisten.then(stop => stop())
    }
  }, [])
  return null
}
