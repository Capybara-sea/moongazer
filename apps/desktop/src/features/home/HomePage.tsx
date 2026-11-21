// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { ChevronRight, RefreshCw } from "lucide-react"
import { AnimatedLogo } from "@/components/brand/AnimatedLogo"
import { LabeledList } from "@/components/Delta"
import { Notice } from "@/components/Notice"
import { Panel } from "@/components/Panel"
import { StatusDot } from "@/components/StatusDot"
import { type AccountGroup, liveUid } from "@/domain/accounts"
import { ImportButton } from "@/features/overview/ImportButton"
import { describeChange, sourceLabel } from "@/features/overview/RecentSnapshots"
import { historyItems } from "@/features/overview/sessions"
import type { Snapshot } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { formatDateTime, formatWhen } from "@/lib/format"
import { navigate } from "@/lib/route"
import { useNow } from "@/lib/useNow"
import { useAccountStore } from "@/stores/accountStore"
import { useCaptureStore } from "@/stores/captureStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"

const t = text.home

/**
 * The page the app opens on: the welcome, then the first steps before any
 * snapshot, else the current account's newest one.
 */
export function HomePage() {
  return (
    // Held near the top rather than centred, so the welcome stays put when
    // what is below it comes.
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-8 px-6 pt-[14vh] pb-6">
      <div className="flex flex-col items-center gap-5">
        <AnimatedLogo className="size-32 flex-none" />
        <h1 className="font-semibold text-2xl leading-[1.3] tracking-[0.04em]">{t.title}</h1>
        <p className="text-center text-[12px] text-muted leading-[2] tracking-[0.12em]">
          {text.about.letter.map(line => (
            <span key={line} className="letter-line block">
              {line}
            </span>
          ))}
        </p>
      </div>
      <Next />
    </div>
  )
}

function Next() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  const group = useAccountStore(s => s.group)
  if (group) return <Latest group={group} />
  if (snapshots?.length === 0) return <FirstSteps />
  if (loadError && !snapshots) return <Notice title={text.overview.loadFailed} detail={loadError} />
  return null
}

function FirstSteps() {
  const capture = useCaptureStore(s => s.capture)
  const off = useCaptureStore(s => s.status?.phase === "off")
  // Auto sync comes first where it can start; importing a file is the way round.
  const sync = capture && off
  return (
    <div className="first-steps flex flex-col items-center gap-3">
      {sync && (
        <>
          <Button
            variant="primary"
            onPress={() => {
              const store = useCaptureStore.getState()
              store.setPanelOpen(true)
              void store.start()
            }}
            className="h-[38px] gap-2 rounded-[9px] px-4 font-medium text-[13px]"
          >
            <RefreshCw aria-hidden className="m-0 size-4" />
            {t.startSync}
          </Button>
          <div className="flex w-56 items-center gap-3 text-[12px] text-muted">
            <span aria-hidden className="h-px flex-1 bg-(--separator)" />
            {t.or}
            <span aria-hidden className="h-px flex-1 bg-(--separator)" />
          </div>
        </>
      )}
      <ImportButton label={t.importFile} quiet={sync} />
    </div>
  )
}

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

function Latest({ group }: { group: AccountGroup }) {
  const now = useNow()
  const liveNow = useCaptureStore(s => liveUid(s.status))
  const row = newestRow(group.snapshots)
  if (!row) return null
  const live = row.live || (group.uid !== null && group.uid === liveNow)
  const { takenAt } = row.snapshot
  return (
    <Panel aria-label={t.latest} className="gap-1.5">
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
          <span className="font-semibold text-[20px] tabular" title={formatDateTime(takenAt)}>
            {formatWhen(takenAt, now)}
          </span>
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
    </Panel>
  )
}
