// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useMemo } from "react"
import { Bar } from "@/components/Bar"
import { Notice } from "@/components/Notice"
import { Panel } from "@/components/Panel"
import { SearchBox } from "@/components/SearchBox"
import { Segmented } from "@/components/Segmented"
import {
  COMPANION_PRIMOGEMS,
  COMPANION_TOTAL,
  FURNISHING_SETS,
  type FurnishingView,
  furnishingView,
} from "@/domain/furnishing"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useCurrentAccount } from "@/stores/accountStore"
import { type FurnishingListView, useRealmListStore } from "@/stores/realmListStore"
import { text } from "@/text/zh"
import { NeedList } from "./FurnishingNeed"
import { CharacterList, SetList } from "./FurnishingSets"
import { AccountNotices, BackLink } from "./parts"

const t = text.furnishingPage
const OUTDOOR = FURNISHING_SETS.filter(s => s.outdoor).length

/**
 * The gift sets: how many are learned and whole in the bag, and those the companions still give
 * primogems for, with what the bag lacks of each and how it is come by. By set or by character.
 */
export function FurnishingPage() {
  const { snapshot, account } = useCurrentAccount()
  const read = account?.collections?.furnishingSets !== undefined
  const view = useMemo(
    () => (account && read ? furnishingView(account) : undefined),
    [account, read],
  )
  const shown = useRealmListStore(s => s.view)
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <BackLink />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-semibold text-[20px] leading-[1.3]">{t.title}</h1>
          {snapshot && (
            <span className="text-[12px] text-muted tabular">
              {[
                t.summary(FURNISHING_SETS.length, FURNISHING_SETS.length - OUTDOOR, OUTDOOR),
                text.characters.snapshotAt(formatDateTime(snapshot.takenAt)),
              ].join(" · ")}
            </span>
          )}
        </div>
        {view && <Toolbar />}
      </div>
      <AccountNotices />
      {account && !read && <Notice title={t.notRead} />}
      {view && !view.bag && <Notice title={t.noBag} />}
      {view && <Stats view={view} />}
      {view && shown === "sets" && <SetList view={view} />}
      {view && shown === "characters" && <CharacterList view={view} />}
      {view && shown === "furnishings" && <NeedList view={view} />}
    </div>
  )
}

function Toolbar() {
  const shown = useRealmListStore(s => s.view)
  const query = useRealmListStore(s => s.query)
  const { setView, setQuery } = useRealmListStore.getState()
  const options: { value: FurnishingListView; label: string }[] = [
    { value: "sets", label: t.views.sets },
    { value: "characters", label: t.views.characters },
    { value: "furnishings", label: t.views.furnishings },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Segmented label={t.viewLabel} value={shown} options={options} onPick={setView} />
      <SearchBox value={query} label={t.search} onChange={setQuery} className="w-[170px]" />
    </div>
  )
}

function Stats({ view }: { view: FurnishingView }) {
  const total = FURNISHING_SETS.length
  return (
    <Panel
      aria-label={t.stats}
      className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 p-4"
    >
      <Stat label={t.learned} value={view.learned} of={total} line={t.learnedLine} />
      <Stat
        label={t.whole}
        value={view.whole}
        of={total}
        line={view.craftable === undefined ? t.wholeMissing : t.wholeLine(view.craftable)}
        note={view.bag ? t.placedNote : undefined}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-muted">{t.primogems}</span>
        <span className="font-semibold text-[20px] text-(--gold-fg) tabular">
          {formatNumber(view.claimable * COMPANION_PRIMOGEMS)}
        </span>
        <Bar
          value={COMPANION_TOTAL > 0 ? view.claimed / COMPANION_TOTAL : 0}
          tone="gold"
          className="h-1.5"
        />
        <span className="text-[12px] text-muted tabular">
          {t.primogemsLine(view.claimed, COMPANION_TOTAL)}
        </span>
      </div>
    </Panel>
  )
}

type StatProps = {
  label: string
  value: number | undefined
  of: number
  line: string
  note?: string
}

function Stat({ label, value, of, line, note }: StatProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="font-semibold text-[20px] tabular">
        {value === undefined ? text.number.missing : formatNumber(value)}{" "}
        <span className="font-normal text-[14px] text-muted">/ {formatNumber(of)}</span>
      </span>
      <Bar value={value !== undefined && of > 0 ? value / of : 0} className="h-1.5" />
      <span className="text-[12px] text-muted tabular">{line}</span>
      {note && <span className="text-[12px] text-muted">{note}</span>}
    </div>
  )
}
