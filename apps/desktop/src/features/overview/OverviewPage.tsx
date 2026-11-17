// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Notice } from "@/components/Notice"
import type { Account } from "@/domain/account"
import type { Snapshot } from "@/lib/backend"
import { type AccountEntry, useAccountStore, useCurrentSnapshot } from "@/stores/accountStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"
import { AccountCard } from "./AccountCard"
import { AnecdoteCard } from "./AnecdoteCard"
import { ChallengeCard } from "./ChallengeCard"
import { CollectionGrid } from "./CollectionGrid"
import { ConfirmImport } from "./ConfirmImport"
import { CountTiles } from "./CountTiles"
import { DailyCard } from "./DailyCard"
import { ImportResults } from "./ImportResults"
import { MonthTable } from "./MonthTable"
import { RecentSnapshots, sourceLabel } from "./RecentSnapshots"
import { RegionGrid } from "./RegionGrid"
import { SnapshotPicker } from "./SnapshotPicker"
import { TrendChart } from "./TrendChart"

/**
 * The account overview, as in the design: account, totals, today's tasks and
 * challenges, the world, then the history. Blocks are direct children of the
 * page's root so they rise in one after another.
 */
export function OverviewPage() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  const current = useCurrentSnapshot()
  useEffect(() => {
    for (const snapshot of [current.snapshot, current.fallback]) {
      if (snapshot?.hasRaw) void useAccountStore.getState().load(snapshot.id)
    }
  }, [current.snapshot, current.fallback])
  // The page keeps showing the previous snapshot until the next one's exports
  // are read, so cards do not vanish and rise again, moving everything below.
  const read = (entry: AccountEntry | undefined) =>
    entry !== undefined && entry.status !== "loading"
  const settled =
    (!current.snapshot?.hasRaw || read(current.entry)) &&
    (!current.fallback || read(current.fallbackEntry))
  const [shown, setShown] = useState<typeof current | null>(null)
  if (
    settled &&
    (shown?.snapshot !== current.snapshot ||
      shown?.entry !== current.entry ||
      shown?.fallbackEntry !== current.fallbackEntry)
  ) {
    setShown(current)
  }
  const { snapshot, older, entry, fallback, fallbackEntry } = shown ?? {}
  const own = snapshot?.hasRaw && entry?.status === "ready" ? entry.account : undefined
  // A GOOD file shows the newest older Leyline snapshot in full.
  const borrowed =
    own && fallback && fallbackEntry?.status === "ready"
      ? { account: fallbackEntry.account, takenAt: fallback.takenAt }
      : undefined
  const account = borrowed?.account ?? own
  const takenAt = borrowed?.takenAt ?? snapshot?.takenAt ?? 0

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4.5 p-6">
      <Header />
      <ImportResults />
      {loadError && !snapshots && <Notice title={text.overview.loadFailed} detail={loadError} />}
      {snapshots?.length === 0 && (
        <Notice title={text.overview.emptyTitle} detail={text.overview.emptyBody} />
      )}
      {snapshot && snapshots && (
        <>
          {/* Keyed by snapshot, so a UID shown for one snapshot is masked again for the next. */}
          {account && <AccountCard key={snapshot.id} account={account} />}
          {(!snapshot.hasRaw || entry?.status === "summaryOnly") && (
            <Notice title={text.snapshot.summaryOnly} />
          )}
          {entry?.status === "failed" && (
            <Notice title={text.snapshot.loadFailed} detail={entry.message} />
          )}
          <CountTiles
            snapshot={snapshot}
            older={older ?? []}
            standIn={borrowed ? fallback : undefined}
          />
          {account && <TodayBlocks account={account} takenAt={takenAt} />}
          {account?.leyline && <WorldBlocks account={account} />}
          <History snapshots={snapshots} />
        </>
      )}
      <ConfirmImport />
    </div>
  )
}

function Header() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const progress = useSnapshotStore(s => s.progress)
  const { snapshot } = useCurrentSnapshot()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col">
        <h1 className="font-semibold text-[20px] leading-[1.3]">{text.overview.title}</h1>
        {snapshot && snapshots && (
          <span className="text-[12px] text-muted">
            {text.overview.source(sourceLabel(snapshot, true), snapshots.length)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <SnapshotPicker />
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          onChange={e => {
            const files = [...(e.currentTarget.files ?? [])]
            // Cleared, so choosing the same file again fires another change.
            e.currentTarget.value = ""
            void useSnapshotStore.getState().importFiles(files)
          }}
        />
        <Button
          isDisabled={progress !== null}
          onPress={() => input.current?.click()}
          className="h-[38px] gap-2 rounded-[9px] px-3.5 font-medium text-[13px]"
        >
          <Upload aria-hidden className="m-0 size-4" />
          {progress
            ? text.overview.importing(progress.done, progress.total)
            : text.overview.importFile}
        </Button>
      </div>
    </div>
  )
}

/** Today's tasks next to the current challenges. */
function TodayBlocks({ account, takenAt }: { account: Account; takenAt: number }) {
  return (
    <div className="flex flex-wrap items-stretch gap-4">
      <DailyCard account={account} takenAt={takenAt} />
      <ChallengeCard account={account} takenAt={takenAt} />
    </div>
  )
}

/** Exploration, anecdotes and collections; Leyline files only. */
function WorldBlocks({ account }: { account: Account }) {
  return (
    <>
      <RegionGrid account={account} />
      <AnecdoteCard account={account} />
      <CollectionGrid account={account} />
    </>
  )
}

/** Mora and Primogems over time and by month on the left, the snapshot list on the right. */
function History({ snapshots }: { snapshots: Snapshot[] }) {
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
        <TrendChart snapshots={snapshots} />
        <MonthTable snapshots={snapshots} />
      </div>
      <div className="min-w-0 flex-[1_1_300px]">
        <RecentSnapshots snapshots={snapshots} />
      </div>
    </div>
  )
}
