// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Tip } from "@/components/Tip"
import type { AccountGroup } from "@/domain/accounts"
import { versionSpan } from "@/domain/calendar"
import { gameDate, nextDailyReset, nextWeeklyReset } from "@/domain/gameTime"
import { formatCountdown } from "@/features/tasks/taskText"
import { formatDateTime } from "@/lib/format"
import { useNow } from "@/lib/useNow"
import { useNewestAccount } from "@/stores/accountStore"
import { text } from "@/text/zh"
import { CalendarCard } from "./CalendarCard"
import { LatestCard } from "./LatestCard"
import { UsageCard } from "./UsageCard"

const h = text.home

/**
 * The home page with an account, on the game rather than the account: the
 * game's date and what is counted down to, the newest snapshot with the tasks
 * left, the time played, then the calendar. Always of the account's newest
 * snapshot, whatever the overview shows. Blocks are direct children of the
 * root, so they rise in one after another.
 */
export function HomeBoard({ group }: { group: AccountGroup }) {
  const now = useNow()
  const newest = useNewestAccount(group)
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <Header now={now} />
      <div className="flex flex-wrap items-stretch gap-4">
        <LatestCard group={group} newest={newest} now={now} />
        <UsageCard snapshots={group.snapshots} now={now} />
      </div>
      <CalendarCard account={newest.account} now={now} />
    </div>
  )
}

/** The game's date, which turns at 04:00, the two resets and the next version, counted down. */
function Header({ now }: { now: number }) {
  const { month, day, weekday } = gameDate(now)
  const version = versionSpan(now)
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <h1 className="font-semibold text-[20px] leading-[1.3]">{h.date(month, day, weekday)}</h1>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <Countdown label={h.dailyReset} at={nextDailyReset(now)} now={now} />
        <Countdown label={h.weeklyReset} at={nextWeeklyReset(now)} now={now} />
        <Countdown
          label={h.versionUpdate}
          at={version.end}
          now={now}
          tip={h.versionTip(formatDateTime(version.end))}
        />
      </div>
    </header>
  )
}

type CountdownProps = { label: string; at: number; now: number; tip?: string }

function Countdown({ label, at, now, tip }: CountdownProps) {
  return (
    <Tip as="div" content={tip ?? formatDateTime(at)} className="flex flex-col items-end">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="tabular font-semibold text-[22px] leading-tight">
        {formatCountdown(at - now)}
      </span>
    </Tip>
  )
}
