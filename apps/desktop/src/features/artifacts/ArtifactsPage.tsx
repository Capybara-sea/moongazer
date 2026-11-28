// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { memo, useMemo, useRef } from "react"
import { CheckboxField } from "@/components/CheckboxField"
import { EmptyState } from "@/components/EmptyState"
import { FilterChip } from "@/components/FilterChip"
import { GameIcon } from "@/components/GameIcon"
import { LabeledSelect } from "@/components/LabeledSelect"
import { Notice } from "@/components/Notice"
import { Pager } from "@/components/Pager"
import { ShownCount } from "@/components/ShownCount"
import { SLOTS } from "@/domain/good"
import { lookup } from "@/domain/names"
import { useEmptyBody } from "@/features/overview/emptyBody"
import { formatDateTime, formatNumber } from "@/lib/format"
import { usePages } from "@/lib/usePages"
import { useCurrentAccount } from "@/stores/accountStore"
import { useArtifactListStore } from "@/stores/artifactListStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { lang, text } from "@/text"
import { ArtifactCard } from "./ArtifactCard"
import {
  type ArtifactRow,
  artifactCounts,
  artifactRows,
  setOptions,
  visibleArtifacts,
} from "./order"

const t = text.artifacts
/** Cards a page; 60 fills the last row at three to six cards a row. */
const PAGE = 60
/** Cards a page shows again (the same row after a new snapshot or filter) are not drawn again. */
const Card = memo(ArtifactCard)

/**
 * The artifact cards: header, slot filter, set filter and the unequipped
 * toggle, then the cards. Blocks are direct children of the page's root so
 * they rise in one after another.
 */
export function ArtifactsPage() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  const emptyBody = useEmptyBody()
  const { snapshot, entry, account } = useCurrentAccount()
  const rows = useMemo(() => account && artifactRows(account.artifacts), [account])
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col">
        <h1 className="font-semibold text-[20px] leading-[1.3]">{t.title}</h1>
        {rows && snapshot && (
          <span className="text-[12px] text-muted tabular">{subtitle(rows, snapshot.takenAt)}</span>
        )}
      </div>
      {loadError && !snapshots && <Notice title={text.overview.loadFailed} detail={loadError} />}
      {snapshots?.length === 0 && <Notice title={text.overview.emptyTitle} detail={emptyBody} />}
      {snapshot && (!snapshot.hasRaw || entry?.status === "summaryOnly") && (
        <Notice title={text.snapshot.summaryOnly} />
      )}
      {entry?.status === "failed" && (
        <Notice title={text.snapshot.loadFailed} detail={entry.message} />
      )}
      {rows && (rows.length === 0 ? <EmptyState>{t.empty}</EmptyState> : <Artifacts rows={rows} />)}
    </div>
  )
}

function subtitle(rows: readonly ArtifactRow[], takenAt: number) {
  const { total, maxed, equipped } = artifactCounts(rows)
  return [
    t.summary(formatNumber(total), formatNumber(maxed), formatNumber(equipped)),
    text.characters.snapshotAt(formatDateTime(takenAt)),
  ].join(" · ")
}

/** The toolbar, one page of cards and the pager. */
function Artifacts({ rows }: { rows: readonly ArtifactRow[] }) {
  const slot = useArtifactListStore(s => s.slot)
  const picked = useArtifactListStore(s => s.set)
  const onlyFree = useArtifactListStore(s => s.onlyFree)
  const sets = useMemo(() => setOptions(rows), [rows])
  const options = useMemo(
    () => [
      {
        value: "",
        label: t.allSets,
        hint: formatNumber(rows.length),
      },
      ...sets.map(({ value, label, count }) => ({
        value,
        label,
        hint: formatNumber(count),
        icon: (
          <span aria-hidden className="contents">
            <GameIcon
              icon={lookup("artifactSets", value).icon}
              label={label}
              className="size-full bg-(--gold-bg) text-(--gold-fg) text-[11px]"
            />
          </span>
        ),
      })),
    ],
    [rows, sets],
  )
  // A set picked in another snapshot may be missing here, where the select could not show it.
  const set = sets.some(option => option.value === picked) ? picked : null
  const shown = useMemo(
    () => visibleArtifacts(rows, { slot, set, onlyFree }),
    [rows, slot, set, onlyFree],
  )
  const { visible, page, pages, setPage } = usePages(shown, PAGE)
  const list = useRef<HTMLElement>(null)
  const { setSet, setOnlyFree } = useArtifactListStore.getState()
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SlotFilter />
        <div className="flex flex-wrap items-center gap-3">
          <LabeledSelect
            label={t.set}
            value={set ?? ""}
            options={options}
            onChange={value => setSet(value || null)}
            className={lang === "en" ? "w-72" : "w-50"}
          />
          <CheckboxField checked={onlyFree} label={t.onlyFree} onChange={setOnlyFree} />
          <ShownCount shown={shown.length} total={rows.length} format={t.shown} />
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState>{t.none}</EmptyState>
      ) : (
        <section
          ref={list}
          aria-label={t.list}
          className="grid scroll-mt-6 grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3"
        >
          {visible.map(row => (
            <Card key={row.id} row={row} />
          ))}
        </section>
      )}
      <Pager
        page={page}
        pages={pages}
        onPage={next => {
          setPage(next)
          list.current?.scrollIntoView({ block: "start" })
        }}
      />
    </>
  )
}

function SlotFilter() {
  const slot = useArtifactListStore(s => s.slot)
  const { setSlot } = useArtifactListStore.getState()
  return (
    <fieldset aria-label={t.bySlot} className="flex flex-wrap gap-1.5">
      <FilterChip pressed={slot === null} onPress={() => setSlot(null)}>
        {t.all}
      </FilterChip>
      {SLOTS.map(option => (
        <FilterChip key={option} pressed={slot === option} onPress={() => setSlot(option)}>
          {text.game.slots[option]}
        </FilterChip>
      ))}
    </fieldset>
  )
}
