// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect } from "react"
import { useAccountStore } from "@/stores/accountStore"
import { useMessageStore } from "@/stores/messageStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { dueReminders, nextDue, reminders } from "./reminders"

/** Timers can fire late after the computer sleeps, so the list is checked at least this often. */
const CHECK_EVERY = 3_600_000

/**
 * Records reminders worked out from the newest snapshot with the full Leyline
 * data, as they come due while the app runs. Renders nothing.
 */
export function ReminderTimer() {
  const latest = useSnapshotStore(s => s.snapshots?.find(x => x.hasRaw && x.format === "leyline"))
  const entry = useAccountStore(s => (latest ? s.entries[latest.id] : undefined))

  useEffect(() => {
    if (latest) void useAccountStore.getState().load(latest.id)
  }, [latest])

  useEffect(() => {
    if (!latest || entry?.status !== "ready") return
    const list = reminders(entry.account, latest.takenAt)
    let timer: ReturnType<typeof setTimeout> | undefined
    const deliver = () => {
      const now = Date.now()
      for (const reminder of dueReminders(list, now)) useMessageStore.getState().add(reminder)
      const next = nextDue(list, now)
      if (next !== undefined) timer = setTimeout(deliver, Math.min(next - now, CHECK_EVERY))
    }
    deliver()
    return () => clearTimeout(timer)
  }, [latest, entry])

  return null
}
