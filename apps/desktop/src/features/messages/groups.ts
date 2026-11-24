// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { formatMonthDay, formatTime, formatWhen, startOfDay } from "@/lib/format"
import type { Message } from "@/stores/messageStore"
import { text } from "@/text/zh"

const DAY = 86_400_000

/** Newest first under today, yesterday and earlier, in local time; empty groups are left out. */
export function messageGroups(messages: readonly Message[], now: number) {
  const today = startOfDay(now)
  // From the day before's start, not 24 hours back: a day with a clock change is not 24 hours.
  const yesterday = startOfDay(today - 1)
  const groups = [text.messages.today, text.messages.yesterday, text.messages.earlier].map(
    label => ({ label, messages: [] as Message[] }),
  )
  for (const message of messages.toSorted((a, b) => b.at - a.at || b.seq - a.seq)) {
    const index = message.at >= today ? 0 : message.at >= yesterday ? 1 : 2
    groups[index]?.messages.push(message)
  }
  return groups.filter(group => group.messages.length > 0)
}

/** How long ago, within a day; then "11-16 20:12". */
export function messageTime(at: number, now: number) {
  return now - at < DAY ? formatWhen(at, now) : `${formatMonthDay(at)} ${formatTime(at)}`
}
