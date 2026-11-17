// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect } from "react"
import { onHiddenToTray, onOpenPage, showNotification } from "@/lib/backend"
import { isPageKey, navigate } from "@/lib/route"
import { readStored, writeStored } from "@/lib/storage"
import { text } from "@/text/zh"

const TOLD_KEY = "moongazer:messages:toldInTray"

/**
 * Goes to the page of a clicked notification, and the first time the window
 * is closed says once, whatever the notification setting, that the app keeps
 * running in the tray. Renders nothing.
 */
export function BackgroundEvents() {
  useEffect(() => {
    const listening = [
      onOpenPage(page => {
        if (isPageKey(page)) navigate(page)
      }),
      onHiddenToTray(() => {
        if (readStored(TOLD_KEY)) return
        writeStored(TOLD_KEY, "yes")
        showNotification(text.messages.stillRunning, text.messages.stillRunningBody, "home").catch(
          () => {
            // Best effort: the tray icon is there either way.
          },
        )
      }),
    ]
    return () => {
      for (const unlisten of listening) void unlisten.then(stop => stop())
    }
  }, [])
  return null
}
