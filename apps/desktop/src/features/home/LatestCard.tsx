// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronRight } from "lucide-react"
import { LabeledList } from "@/components/Delta"
import { Panel } from "@/components/Panel"
import { StatusDot } from "@/components/StatusDot"
import { Tip } from "@/components/Tip"
import type { Account } from "@/domain/account"
import { type AccountGroup, liveUid } from "@/domain/accounts"
import { describeChange, sourceLabel } from "@/features/overview/RecentSnapshots"
import { historyItems } from "@/features/overview/sessions"
import { isShown, onTodo, tabCounts, useTodoPrefs } from "@/features/tasks/taskFilter"
import { useTaskBoard } from "@/features/tasks/useTaskBoard"
import type { Snapshot } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { formatDateTime, formatWhen } from "@/lib/format"
import { navigate } from "@/lib/route"
import { useCaptureStore } from "@/stores/captureStore"
import { text } from "@/text"

const t = text.home

type Row = {
  snapshot: Snapshot
  live: boolean
  change: ReturnType<typeof describeChange>
  first: boolean
}

/**
 * The account's newest row as the overview's history has it: a login as a
 * whole, else the newest snapshot against the one before.
 */
function newestRow(snapshots: Snapshot[]): Row | null {
  const item = historyItems(snapshots)[0]
  if (!item) return null
  if (item.kind === "session") {
    const { newest, oldest } = item
    const change = newest === oldest ? null : describeChange(newest, [oldest])
    return { snapshot: newest, live: item.live, change, first: false }
  }
  const older = snapshots.slice(item.index + 1)
  return {
    snapshot: item.snapshot,
    live: false,
    change: describeChange(item.snapshot, older),
    first: older.length === 0,
  }
}

type Newest = { snapshot?: Snapshot; account?: Account }

type Props = {
  group: AccountGroup
  /** The account's newest snapshot whose export is kept, which the to-do count is of. */
  newest: Newest
  now: number
}

/**
 * The account's newest snapshot: when, from where, what changed in the
 * totals, and how many of the to-do card's tasks are left.
 */
export function LatestCard({ group, newest, now }: Props) {
  const liveNow = useCaptureStore(s => liveUid(s.status))
  const row = newestRow(group.snapshots)
  if (!row) return null
  const live = row.live || (group.uid !== null && group.uid === liveNow)
  const { takenAt } = row.snapshot
  return (
    <Panel aria-label={t.latest} className="min-w-0 flex-[1_1_380px] gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-[15px]">{t.latest}</h2>
        <button
          type="button"
          onClick={() => navigate("overview")}
          className="flex h-[30px] cursor-pointer items-center gap-0.5 rounded-[8px] pr-1 pl-2 text-(--accent-text) text-[13px] transition-colors duration-150 hover:bg-default/60 motion-reduce:transition-none"
        >
          {t.openOverview}
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        {live ? (
          <StatusDot tone="ok" halo className="font-semibold text-[20px]">
            {text.snapshot.live}
          </StatusDot>
        ) : (
          <Tip className="font-semibold text-[20px] tabular" content={formatDateTime(takenAt)}>
            {formatWhen(takenAt, now)}
          </Tip>
        )}
        <span className="rounded-[6px] bg-surface-secondary px-2 py-px text-[11px] text-muted">
          {sourceLabel(row.snapshot)}
        </span>
      </div>
      {/* Keyed by what it says, so new totals while playing fade in. */}
      <span
        key={JSON.stringify(row.change)}
        data-rise
        className={cn("text-[13px] tabular-nums", !row.change && "text-muted")}
      >
        {row.change ? (
          <LabeledList items={row.change} />
        ) : row.first ? (
          text.overview.first
        ) : (
          text.overview.unchanged
        )}
      </span>
      {newest.snapshot && newest.account && (
        <Pending account={newest.account} uid={newest.snapshot.uid} now={now} />
      )}
    </Panel>
  )
}

type PendingProps = { account: Account; uid: number | null; now: number }

/** The to-do card's count of all it lists still to do. */
function Pending({ account, uid, now }: PendingProps) {
  const [prefs] = useTodoPrefs()
  const { rows } = useTaskBoard(account, uid, now)
  const left = tabCounts(rows.filter(row => onTodo(row) && isShown(row, prefs))).all
  return (
    <span className="tabular text-[13px] text-muted">
      {left > 0 ? t.tasksLeft(left) : t.tasksDone}
    </span>
  )
}
