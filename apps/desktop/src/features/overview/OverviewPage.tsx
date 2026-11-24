// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { useState } from "react"
import { Notice } from "@/components/Notice"
import { Panel } from "@/components/Panel"
import type { Account } from "@/domain/account"
import { isNewest } from "@/domain/accounts"
import { TodoCard } from "@/features/tasks/TodoCard"
import { useTaskBoard } from "@/features/tasks/useTaskBoard"
import { isHead, type Snapshot } from "@/lib/backend"
import { useNow } from "@/lib/useNow"
import { useAccountStore, useCurrentSnapshot } from "@/stores/accountStore"
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
import { ResinPlanCard } from "./ResinPlanCard"
import { ReviewNotices } from "./ReviewNotices"
import { SnapshotPicker } from "./SnapshotPicker"
import { TrendChart } from "./TrendChart"

/**
 * The account overview, as in the design: account, totals, today's tasks and
 * challenges, the to-do card and the resin plan, the world, then the history. Blocks are direct children of the
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
      shown?.list !== current.list ||
      shown?.selected !== current.selected)
  ) {
    setShown(current)
  }
  const { snapshot, list, older, entry, selected } = shown ?? {}
  const account = snapshot?.hasRaw && entry?.status === "ready" ? entry.account : undefined
  const latest =
    snapshot !== undefined && list !== undefined && isNewest(snapshot, list, selected ?? null)

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
          {account && <TodayBlocks account={account} snapshot={snapshot} latest={latest} />}
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

type TodayProps = {
  account: Account
  snapshot: Snapshot
  /** Whether it is the account's newest snapshot, the only one with the to-do card and the resin plan. */
  latest: boolean
}

/**
 * Today's tasks next to the current challenges, then the to-do card next to
 * the resin plan, those two for the newest snapshot only.
 */
function TodayBlocks({ account, snapshot, latest }: TodayProps) {
  return (
    <>
      <div className="flex flex-wrap items-stretch gap-4">
        <DailyCard account={account} takenAt={snapshot.takenAt} />
        <ChallengeCard account={account} takenAt={snapshot.takenAt} />
      </div>
      {latest ? <Plans account={account} snapshot={snapshot} /> : <LatestOnly />}
    </>
  )
}

/** The to-do card and the resin plan, of the newest snapshot. */
function Plans({ account, snapshot }: { account: Account; snapshot: Snapshot }) {
  const now = useNow()
  const board = useTaskBoard(account, snapshot.uid, now)
  return (
    <div className="flex flex-wrap items-start gap-4">
      <TodoCard board={board} uid={snapshot.uid} now={now} />
      <ResinPlanCard account={account} takenAt={snapshot.takenAt} now={now} />
    </div>
  )
}

/** In place of the tasks and the resin plan while an older snapshot is shown. */
function LatestOnly() {
  return (
    <Panel className="flex-row flex-wrap items-center justify-between gap-2 py-2.5">
      <p className="text-[13px] text-muted">{text.overview.latestOnly}</p>
      <Button variant="secondary" onPress={() => useAccountStore.getState().select(null)}>
        {text.overview.showLatest}
      </Button>
    </Panel>
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
