// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect, useState } from "react"
import { Panel } from "@/components/Panel"
import type { Snapshot } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { formatDateTime, formatDelta, formatWhen } from "@/lib/format"
import { text } from "@/text/zh"

/** Rows shown before "all" is pressed. */
const FIRST_ROWS = 8

/** Where a snapshot came from; the long form adds the format, or the tool for GOOD. */
export function sourceLabel(snapshot: Snapshot, long: boolean) {
  if (snapshot.format === "leyline") {
    return long
      ? text.overview.leylineLong(snapshot.source)
      : text.overview.leyline(snapshot.source)
  }
  return long ? text.overview.goodLong(snapshot.source) : text.overview.good
}

/**
 * What changed since the snapshot before (`older` is every older one, newest
 * first); null when no total moved. A GOOD file without materials knows no
 * Mora or Primogems, so currencies compare with the last snapshot that did.
 */
export function describeChange(snapshot: Snapshot, older: Snapshot[]) {
  const { change } = text.overview
  const now = snapshot.summary
  const before = older[0]?.summary
  if (!before) return null
  const lastKnown = (key: "mora" | "primogems") =>
    older.find(s => s.summary[key] !== null)?.summary[key] ?? null
  const parts = (
    [
      [change.mora, now.mora, lastKnown("mora")],
      [change.primogems, now.primogems, lastKnown("primogems")],
      [change.characters, now.characters, before.characters],
      [change.weapons, now.weapons, before.weapons],
      [change.artifacts, now.artifacts, before.artifacts],
    ] as const
  )
    .filter(([, a, b]) => a !== null && b !== null && a !== b)
    .map(([label, a, b]) => `${label} ${formatDelta((a ?? 0) - (b ?? 0))}`)
  return parts.length > 0 ? parts.join(" · ") : null
}

/** The history, newest first, each with what changed since the one before. */
export function RecentSnapshots({ snapshots }: { snapshots: Snapshot[] }) {
  const [all, setAll] = useState(false)
  // Relative times ("5 minutes ago" and so on) move on while the page stays open.
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const shown = all ? snapshots : snapshots.slice(0, FIRST_ROWS)
  return (
    <Panel aria-label={text.overview.recent} className="gap-0 px-4 pt-3.5 pb-1.5">
      <div className="flex items-center justify-between gap-2 pb-2">
        <h2 className="font-semibold text-base">{text.overview.recent}</h2>
        {snapshots.length > FIRST_ROWS && (
          <button
            type="button"
            onClick={() => setAll(!all)}
            className="h-[30px] cursor-pointer rounded-[8px] px-2 text-[13px] text-accent hover:bg-default/60"
          >
            {all ? text.overview.showLess : text.overview.showAll}
          </button>
        )}
      </div>
      {shown.map((snapshot, i) => {
        const previous = snapshots[i + 1]
        const change = describeChange(snapshot, snapshots.slice(i + 1))
        return (
          <div
            key={snapshot.id}
            data-rise
            className="flex flex-col gap-1 border-(--separator) border-t py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[13px]" title={formatDateTime(snapshot.takenAt)}>
                {formatWhen(snapshot.takenAt, now)}
              </span>
              <span className="rounded-[6px] bg-surface-secondary px-2 py-px text-[11px] text-muted">
                {sourceLabel(snapshot, false)}
              </span>
            </div>
            <span className={cn("text-[13px] tabular-nums", !change && "text-muted")}>
              {change ?? (previous ? text.overview.unchanged : text.overview.first)}
            </span>
          </div>
        )
      })}
    </Panel>
  )
}
