// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"
import { Notice } from "@/components/Notice"
import type { Account } from "@/domain/account"
import { isHead, type Snapshot } from "@/lib/backend"
import { useCurrentSnapshot } from "@/stores/accountStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"
import { AccountCard } from "./AccountCard"
import { AnecdoteCard } from "./AnecdoteCard"
import { ChallengeCard } from "./ChallengeCard"
import { CollectionGrid } from "./CollectionGrid"
import { ConfirmImport } from "./ConfirmImport"
import { CountTiles } from "./CountTiles"
import { DailyCard } from "./DailyCard"
import { useEmptyBody } from "./emptyBody"
import { ImportButton } from "./ImportButton"
import { ImportResults } from "./ImportResults"
import { MonthTable } from "./MonthTable"
import { RecentSnapshots, sourceLabel } from "./RecentSnapshots"
import { RegionGrid } from "./RegionGrid"
import { ReviewNotices } from "./ReviewNotices"
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
  const emptyBody = useEmptyBody()
  const current = useCurrentSnapshot()
  // The page keeps showing the previous snapshot until the next one's export
  // is read, so cards do not vanish and rise again, moving everything below.
  // Its account's list is kept with it, so the header and the history change
  // with the cards when the account does.
  const settled =
    !current.snapshot?.hasRaw || (current.entry !== undefined && current.entry.status !== "loading")
  const [shown, setShown] = useState<typeof current | null>(null)
  if (
    settled &&
    (shown?.snapshot !== current.snapshot ||
      shown?.entry !== current.entry ||
      shown?.list !== current.list)
  ) {
    setShown(current)
  }
  const { snapshot, list, older, entry } = shown ?? {}
  const account = snapshot?.hasRaw && entry?.status === "ready" ? entry.account : undefined

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4.5 p-6">
      <Header snapshot={snapshot} list={list} />
      <ImportResults />
      {snapshots && <ReviewNotices snapshots={snapshots} />}
      {loadError && !snapshots && <Notice title={text.overview.loadFailed} detail={loadError} />}
      {snapshots?.length === 0 && <Notice title={text.overview.emptyTitle} detail={emptyBody} />}
      {snapshot && list && (
        <>
          {/*
            Keyed by snapshot, so the eye's choice for one snapshot goes back to
            the setting for the next; an auto sync login's snapshots and head
            rows share one.
          */}
          {account && <AccountCard key={snapshot.session ?? snapshot.id} account={account} />}
          {(!snapshot.hasRaw || entry?.status === "summaryOnly") && (
            <Notice title={text.snapshot.summaryOnly} />
          )}
          {entry?.status === "failed" && (
            <Notice title={text.snapshot.loadFailed} detail={entry.message} />
          )}
          <CountTiles snapshot={snapshot} older={older ?? []} />
          {account && <TodayBlocks account={account} takenAt={snapshot.takenAt} />}
          {account && <WorldBlocks account={account} />}
          <History snapshots={list} />
        </>
      )}
      <ConfirmImport />
    </div>
  )
}

/** The title, the source and how many snapshots the account has, not counting head rows. */
function Header({ snapshot, list }: { snapshot?: Snapshot; list?: Snapshot[] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col">
        <h1 className="font-semibold text-[20px] leading-[1.3]">{text.overview.title}</h1>
        {snapshot && list && (
          <span className="text-[12px] text-muted">
            {text.overview.source(sourceLabel(snapshot), list.filter(s => !isHead(s)).length)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <SnapshotPicker />
        <ImportButton />
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

/** Exploration, anecdotes and collections. */
function WorldBlocks({ account }: { account: Account }) {
  return (
    <>
      <RegionGrid account={account} />
      <AnecdoteCard account={account} />
      <CollectionGrid account={account} />
    </>
  )
}

/**
 * Mora and Primogems over time and by month on the left, the snapshot list on
 * the right; all of one account.
 */
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
