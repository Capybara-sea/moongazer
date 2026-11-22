// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { memo, useMemo } from "react"
import { CheckboxField } from "@/components/CheckboxField"
import { EmptyState } from "@/components/EmptyState"
import { FilterChip } from "@/components/FilterChip"
import { Notice } from "@/components/Notice"
import { SearchBox } from "@/components/SearchBox"
import { MATERIAL_TABS, type MaterialTab } from "@/domain/names"
import { useEmptyBody } from "@/features/overview/emptyBody"
import { cn } from "@/lib/cn"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useBatches } from "@/lib/useBatches"
import { useCurrentAccount, usePreviousAccount } from "@/stores/accountStore"
import { useMaterialListStore } from "@/stores/materialListStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"
import { MaterialCard } from "./MaterialCard"
import {
  type MaterialGroup,
  type MaterialRow,
  materialRows,
  tabCounts,
  tabGroups,
  takeRows,
  visibleRows,
} from "./order"

const t = text.materials
/** Cards already drawn are skipped when the filters change: their rows stay the same. */
const Card = memo(MaterialCard)

/**
 * The materials in tabs, by game type, with the change since the previous
 * snapshot. Header and toolbar, the tabs, then one block per type, as direct
 * children of the page's root so they rise in one after another.
 */
export function MaterialsPage() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  const emptyBody = useEmptyBody()
  const { snapshot, entry, account } = useCurrentAccount()
  const previous = usePreviousAccount()
  // An older export without materials has nothing to compare with.
  const compared = previous?.materials.size === 0 ? null : previous
  // Nothing shows until the older account is read: the rows it adds would push the others.
  const rows = useMemo(
    () => (account && compared !== undefined ? materialRows(account, compared) : undefined),
    [account, compared],
  )
  const hasCompared = compared != null
  return (
    <div className="flex flex-col gap-4.5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="font-semibold text-[20px] leading-[1.3]">{t.title}</h1>
          {rows && snapshot && (
            <span className="text-[12px] text-muted tabular">
              {[
                t.summary(formatNumber(rows.length)),
                hasCompared ? t.compared : t.notCompared,
                text.characters.snapshotAt(formatDateTime(snapshot.takenAt)),
              ].join(" · ")}
            </span>
          )}
        </div>
        {rows && rows.length > 0 && <Toolbar hasCompared={hasCompared} />}
      </div>
      {loadError && !snapshots && <Notice title={text.overview.loadFailed} detail={loadError} />}
      {snapshots?.length === 0 && <Notice title={text.overview.emptyTitle} detail={emptyBody} />}
      {snapshot && (!snapshot.hasRaw || entry?.status === "summaryOnly") && (
        <Notice title={text.snapshot.summaryOnly} />
      )}
      {entry?.status === "failed" && (
        <Notice title={text.snapshot.loadFailed} detail={entry.message} />
      )}
      {rows &&
        (rows.length === 0 ? (
          <EmptyState>{t.empty}</EmptyState>
        ) : (
          <Tabbed rows={rows} hasCompared={hasCompared} />
        ))}
    </div>
  )
}

/** "Only changed" shows only when there is something to compare with. */
function Toolbar({ hasCompared }: { hasCompared: boolean }) {
  const onlyChanged = useMaterialListStore(s => s.onlyChanged)
  const query = useMaterialListStore(s => s.query)
  const { setOnlyChanged, setQuery } = useMaterialListStore.getState()
  return (
    <div className="flex flex-wrap items-center gap-3">
      {hasCompared && (
        <CheckboxField checked={onlyChanged} label={t.onlyChanged} onChange={setOnlyChanged} />
      )}
      <SearchBox value={query} label={t.search} onChange={setQuery} />
    </div>
  )
}

/** The tabs, then the selected one's blocks; the counts on the tabs follow the filters too. */
function Tabbed({ rows, hasCompared }: { rows: readonly MaterialRow[]; hasCompared: boolean }) {
  // Hidden with nothing to compare with, "only changed" keeps everything then.
  const onlyChanged = useMaterialListStore(s => s.onlyChanged) && hasCompared
  const query = useMaterialListStore(s => s.query)
  const tab = useMaterialListStore(s => s.tab)
  const shown = useMemo(() => visibleRows(rows, { onlyChanged, query }), [rows, onlyChanged, query])
  const counts = useMemo(() => tabCounts(shown), [shown])
  const groups = useMemo(() => tabGroups(shown, tab), [shown, tab])
  return (
    <>
      <Tabs tab={tab} counts={counts} />
      <Groups groups={groups} label={t.tabs[tab]} />
    </>
  )
}

/**
 * Pressed chips in a fieldset, as the other pages' filters are: ARIA tabs
 * would also need arrow keys to move between them.
 */
function Tabs({ tab, counts }: { tab: MaterialTab; counts: ReadonlyMap<MaterialTab, number> }) {
  const { setTab } = useMaterialListStore.getState()
  return (
    <fieldset aria-label={t.byTab} className="flex flex-wrap gap-1.5">
      {MATERIAL_TABS.map(option => (
        <FilterChip key={option} pressed={tab === option} onPress={() => setTab(option)}>
          {t.tabs[option]}
          <span
            className={cn(
              "font-normal text-[12px] tabular",
              tab === option ? "text-accent-foreground/80" : "text-muted",
            )}
          >
            {formatNumber(counts.get(option) ?? 0)}
          </span>
        </FilterChip>
      ))}
    </fieldset>
  )
}

/** The tab's blocks, or a note when the filters leave none; drawn in batches like the artifact cards. */
function Groups({ groups, label }: { groups: readonly MaterialGroup[]; label: string }) {
  const flat = useMemo(() => groups.flatMap(group => group.rows), [groups])
  const { visible, more, sentinel } = useBatches(flat)
  if (groups.length === 0) return <EmptyState>{t.none}</EmptyState>
  const blocks = takeRows(groups, visible.length).map(({ group, rows }) => (
    <section
      key={group.title ?? label}
      aria-label={group.title ?? label}
      className="flex flex-col gap-2.5"
    >
      {group.title !== undefined && (
        <div className="flex items-baseline gap-2">
          <h2 className="font-semibold text-[15px]">{group.title}</h2>
          <span className="text-[12px] text-muted tabular">
            {t.kinds(formatNumber(group.rows.length))}
          </span>
        </div>
      )}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
        {rows.map(row => (
          <Card key={row.key} row={row} />
        ))}
      </ul>
    </section>
  ))
  return (
    <>
      {blocks}
      {more && <div ref={sentinel} aria-hidden className="h-px" />}
    </>
  )
}
