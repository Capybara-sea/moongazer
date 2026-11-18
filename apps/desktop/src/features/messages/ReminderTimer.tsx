// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect, useState } from "react"
import type { Account } from "@/domain/account"
import { type AccountGroup, latestKept } from "@/domain/accounts"
import { useAccountStore } from "@/stores/accountStore"
import { useMessageStore } from "@/stores/messageStore"
import { dueReminders, nextDue, reminders } from "./reminders"

/** Timers can fire late after the computer sleeps, so the list is checked at least this often. */
const CHECK_EVERY = 3_600_000

/** Records each account's reminders as they come due while the app runs. Renders nothing. */
export function ReminderTimer() {
  const accounts = useAccountStore(s => s.accounts)
  return accounts.map(group => <AccountReminders key={group.token} group={group} />)
}

/**
 * The reminders worked out from the account's newest snapshot whose export
 * is kept; the account store reads it.
 */
function AccountReminders({ group }: { group: AccountGroup }) {
  const latest = latestKept(group)
  const entry = useAccountStore(s => (latest ? s.entries[latest.id] : undefined))
  // While playing a new head row comes every 15 s, and none is read while the
  // window is hidden: the reminders keep the last account read until then.
  const [source, setSource] = useState<{ account: Account; takenAt: number } | null>(null)
  if (!latest && source) setSource(null)
  if (latest && entry?.status === "ready" && entry.account !== source?.account) {
    setSource({ account: entry.account, takenAt: latest.takenAt })
  }

  const { token } = group
  useEffect(() => {
    if (!source) return
    const list = reminders(source.account, source.takenAt, token)
    let timer: ReturnType<typeof setTimeout> | undefined
    const deliver = () => {
      const now = Date.now()
      for (const reminder of dueReminders(list, now)) useMessageStore.getState().add(reminder)
      const next = nextDue(list, now)
      if (next !== undefined) timer = setTimeout(deliver, Math.min(next - now, CHECK_EVERY))
    }
    deliver()
    return () => clearTimeout(timer)
  }, [source, token])

  return null
}
