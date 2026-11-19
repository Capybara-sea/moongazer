// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronRight } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { LabeledList } from "@/components/Delta"
import { Panel } from "@/components/Panel"
import { type ChangeRow, changeRows } from "@/domain/changes"
import { type Snapshot, toBackendError } from "@/lib/backend"
import { getSessionTimeline } from "@/lib/backend/sync"
import { cn } from "@/lib/cn"
import { formatDateTime, formatTime, formatWhen, type Labeled, signedDelta } from "@/lib/format"
import { useNow } from "@/lib/useNow"
import { useVisible } from "@/lib/useVisible"
import { text } from "@/text/zh"
import { historyItems, type SessionItem } from "./sessions"

const t = text.overview
/** Rows shown before "all" is pressed. */
const FIRST_ROWS = 8
/** Seconds of a session's timeline shown before "all" is pressed. */
const FIRST_SECONDS = 20
const BADGE = "rounded-[6px] bg-surface-secondary px-2 py-px text-[11px] text-muted"
const REVIEW_BADGE =
  "rounded-[6px] bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] px-2 py-px text-(--warn) text-[11px]"
const LIVE_BADGE =
  "rounded-[6px] bg-[color-mix(in_srgb,var(--ok)_16%,transparent)] px-2 py-px text-(--ok) text-[11px]"
const MORE =
  "h-[30px] cursor-pointer rounded-[8px] px-2 text-(--accent-text) text-[13px] hover:bg-default/60"

/** The source auto sync writes into its exports (src-tauri/src/capture/decoder.rs). */
const SYNC_SOURCE = "Moongazer"

/** Where a snapshot came from. */
export function sourceLabel(snapshot: Snapshot) {
  return snapshot.source === SYNC_SOURCE ? t.autoSync : t.imported
}

/**
 * What changed since the snapshot before (`older` is every older one, newest
 * first); null when no total moved. A snapshot without materials knows no
 * Mora or Primogems, so currencies compare with the last snapshot that did.
 */
export function describeChange(snapshot: Snapshot, older: Snapshot[]): Labeled[] | null {
  const { change } = t
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
    .map(([label, a, b]) => ({ label, change: signedDelta((a ?? 0) - (b ?? 0)) }))
  return parts.length > 0 ? parts : null
}

/**
 * The history, newest first: each auto sync login as one row that opens its
 * timeline, and every other snapshot with what changed since the one before.
 */
export function RecentSnapshots({ snapshots }: { snapshots: Snapshot[] }) {
  const [all, setAll] = useState(false)
  // Relative times ("5 minutes ago" and so on) move on while the page stays open.
  const now = useNow()
  const items = useMemo(() => historyItems(snapshots), [snapshots])
  const shown = all ? items : items.slice(0, FIRST_ROWS)
  return (
    <Panel aria-label={t.recent} className="gap-0 px-4 pt-3.5 pb-1.5">
      <div className="flex items-center justify-between gap-2 pb-2">
        <h2 className="font-semibold text-base">{t.recent}</h2>
        {items.length > FIRST_ROWS && (
          <button type="button" onClick={() => setAll(!all)} className={MORE}>
            {all ? t.showLess : t.showAll}
          </button>
        )}
      </div>
      {shown.map(item =>
        item.kind === "session" ? (
          <SessionRow key={`session:${item.session}`} item={item} now={now} />
        ) : (
          <SnapshotRow
            key={item.snapshot.id}
            snapshot={item.snapshot}
            older={snapshots.slice(item.index + 1)}
            now={now}
          />
        ),
      )}
    </Panel>
  )
}

type RowProps = { snapshot: Snapshot; older: Snapshot[]; now: number }

function SnapshotRow({ snapshot, older, now }: RowProps) {
  const change = describeChange(snapshot, older)
  return (
    <div data-rise className="flex flex-col gap-1 border-(--separator) border-t py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[13px]" title={formatDateTime(snapshot.takenAt)}>
          {formatWhen(snapshot.takenAt, now)}
        </span>
        <span className="flex flex-none items-center gap-1.5">
          {snapshot.review && <span className={REVIEW_BADGE}>{text.review.badge}</span>}
          <span className={BADGE}>{sourceLabel(snapshot)}</span>
        </span>
      </div>
      <span className={cn("text-[13px] tabular-nums", !change && "text-muted")}>
        {change ? <LabeledList items={change} /> : older[0] ? t.unchanged : t.first}
      </span>
    </div>
  )
}

/** A login's row: when it ran and what its totals did; pressed, it opens its timeline. */
function SessionRow({ item, now }: { item: SessionItem; now: number }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const { newest, oldest } = item
  const change = newest === oldest ? null : describeChange(newest, [oldest])
  const from = formatTime(oldest.takenAt)
  const to = formatTime(newest.takenAt)
  return (
    <div data-rise className="flex flex-col border-(--separator) border-t">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer flex-col gap-1 py-2.5 text-left"
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <ChevronRight
              aria-hidden
              className={cn(
                "size-3.5 flex-none text-muted transition-transform duration-150 ease-out motion-reduce:transition-none",
                open && "rotate-90",
              )}
            />
            <span className="font-semibold text-[13px]" title={formatDateTime(oldest.takenAt)}>
              {formatWhen(oldest.takenAt, now)}
            </span>
            <span className="truncate text-[12px] text-muted tabular">
              {from === to ? from : t.span(from, to)}
            </span>
          </span>
          <span className="flex flex-none items-center gap-1.5">
            {item.review && <span className={REVIEW_BADGE}>{text.review.badge}</span>}
            {item.live && <span className={LIVE_BADGE}>{t.live}</span>}
            <span className={BADGE}>{t.autoSync}</span>
          </span>
        </span>
        {/* Keyed by what it says, so new totals while playing fade in. */}
        <span
          key={JSON.stringify(change)}
          data-rise
          className={cn("pl-5 text-[13px] tabular-nums", !change && "text-muted")}
        >
          {change ? <LabeledList items={change} /> : t.unchanged}
        </span>
      </button>
      {/* The newest row's id moves with each batch, so an open timeline reads again. */}
      {open && <Timeline id={id} session={item.session} version={newest.id} />}
    </div>
  )
}

type TimelineState =
  | { status: "loading" }
  /** `stored`: whether the session has batches, named or not. */
  | { status: "ready"; rows: ChangeRow[]; stored: boolean }
  | { status: "failed"; message: string }

type TimelineProps = { id: string; session: number; version: number }

/**
 * A session's changes a row a second, newest first. Read again when
 * `version` moves while the window shows; the rows read before stay meanwhile.
 */
function Timeline({ id, session, version }: TimelineProps) {
  const [state, setState] = useState<TimelineState>({ status: "loading" })
  /** The version last read. */
  const [read, setRead] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  const visible = useVisible()
  useEffect(() => {
    if (!visible || read === version) return
    let current = true
    getSessionTimeline(session).then(
      batches => {
        if (!current) return
        setState({ status: "ready", rows: changeRows(batches), stored: batches.length > 0 })
        setRead(version)
      },
      error => {
        if (current) setState({ status: "failed", message: toBackendError(error).message })
      },
    )
    return () => {
      current = false
    }
  }, [session, version, visible, read])
  const rows = state.status === "ready" ? state.rows : []
  const shown = all ? rows : rows.slice(0, FIRST_SECONDS)
  return (
    <div id={id} className="mb-2.5 flex flex-col gap-1.5">
      <ul className="glass-inset flex flex-col gap-1.5 rounded-[10px] bg-surface-secondary px-3 py-2.5 text-[12px]">
        {state.status === "loading" && <li className="text-muted">{t.timelineLoading}</li>}
        {state.status === "failed" && (
          <li className="select-text text-danger">
            {t.timelineFailed}: {state.message}
          </li>
        )}
        {state.status === "ready" && rows.length === 0 && (
          <li className="text-muted">{state.stored ? t.timelineUnnamed : t.timelineEmpty}</li>
        )}
        {shown.map(row => (
          <li key={row.second} data-rise className="flex items-baseline gap-2.5 tabular">
            <span className="flex-none text-muted">{row.time}</span>
            <span className="min-w-0">
              <LabeledList items={row.lines} />
            </span>
          </li>
        ))}
      </ul>
      {rows.length > FIRST_SECONDS && (
        <button type="button" onClick={() => setAll(!all)} className={cn(MORE, "self-start")}>
          {all ? t.showLess : t.showAll}
        </button>
      )}
    </div>
  )
}
