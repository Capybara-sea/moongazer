// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { toast } from "@heroui/react"
import { useEffect } from "react"
import { text } from "@/i18n"
import { onWishProgress, onWishRead } from "@/lib/backend/wishes"
import { useWishStore } from "@/stores/wishStore"
import { readLines } from "./readNotice"

/**
 * Takes the wish history reads' events, wherever the user is: a bottom-right
 * toast spins while a read is under way and then says how it ended. Also
 * reads the auto read setting. Renders nothing.
 */
export function WishEvents() {
  useEffect(() => {
    void useWishStore.getState().loadAutoRead()
    let reading: string | null = null
    // A failure's toast stays until closed; the next read turns it into its own.
    let failure: string | null = null
    const listening = [
      onWishProgress(progress => {
        useWishStore.getState().onProgress(progress)
        if (reading === null) {
          const loading = { isLoading: true, timeout: 0 }
          reading =
            failure === null
              ? toast(text.wishes.autoRead.reading, loading)
              : toast.update(failure, text.wishes.autoRead.reading, {
                  ...loading,
                  variant: "default",
                })
          failure = null
        }
      }),
      onWishRead(end => {
        useWishStore.getState().onRead(end)
        const [title, detail] = readLines(end)
        const options = {
          description: detail,
          variant: end.error ? ("warning" as const) : ("default" as const),
          isLoading: false,
          // A failure stays until closed: it says what to do, and nothing else on the page does.
          timeout: end.error && end.error !== "stopped" ? 0 : 6000,
        }
        const target = reading ?? failure
        const id = target === null ? toast(title, options) : toast.update(target, title, options)
        failure = options.timeout === 0 ? id : null
        reading = null
      }),
    ]
    return () => {
      for (const unlisten of listening) void unlisten.then(stop => stop())
    }
  }, [])
  return null
}
