// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useMemo } from "react"
import { Bar } from "@/components/Bar"
import { FilterChip } from "@/components/FilterChip"
import { Notice } from "@/components/Notice"
import { Panel } from "@/components/Panel"
import { Segmented } from "@/components/Segmented"
import {
  SPINCRYSTAL_AREAS,
  SPINCRYSTALS,
  type SpincrystalView,
  spincrystalView,
} from "@/domain/spincrystals"
import { cn } from "@/lib/cn"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useCurrentAccount } from "@/stores/accountStore"
import { type SpincrystalFilter, useRealmListStore } from "@/stores/realmListStore"
import { text } from "@/text"
import { AccountNotices, BackLink } from "./parts"

const t = text.spincrystalPage
const FILTERS: SpincrystalFilter[] = ["all", "placed", "bag", "none"]

/** The spincrystals by area: which are in the realm, which wait in the bag and where the rest are. */
export function SpincrystalsPage() {
  const { snapshot, account } = useCurrentAccount()
  const view = useMemo(() => (account ? spincrystalView(account) : undefined), [account])
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <BackLink />
      <div className="flex flex-col gap-0.5">
        <h1 className="font-semibold text-[20px] leading-[1.3]">{t.title}</h1>
        {snapshot && (
          <span className="text-[12px] text-muted tabular">
            {[
              t.summary(SPINCRYSTALS.length),
              text.characters.snapshotAt(formatDateTime(snapshot.takenAt)),
            ].join(" · ")}
          </span>
        )}
      </div>
      <AccountNotices />
      {view && !view.realmRead && <Notice title={t.realmNote} />}
      {view && <Stats view={view} />}
      {view && <Areas view={view} />}
      {view && <Table view={view} />}
    </div>
  )
}

function Stats({ view }: { view: SpincrystalView }) {
  const total = SPINCRYSTALS.length
  const had = view.placed + view.bag
  return (
    <Panel
      aria-label={t.stats}
      className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 p-4"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-muted">{t.had}</span>
        <span className="font-semibold text-[20px] tabular">
          {formatNumber(had)}{" "}
          <span className="font-normal text-[14px] text-muted">/ {formatNumber(total)}</span>
        </span>
        <Bar value={total > 0 ? had / total : 0} className="h-1.5" />
      </div>
      <Count
        label={t.placed}
        value={view.realmRead ? formatNumber(view.placed) : t.notPlacedRead}
        line={t.placedLine}
      />
      <Count label={t.bag} value={formatNumber(view.bag)} line={t.bagLine} />
      <Count label={t.none} value={formatNumber(total - had)} />
    </Panel>
  )
}

function Count({ label, value, line }: { label: string; value: string; line?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="font-semibold text-[20px] tabular">{value}</span>
      {line && <span className="text-[12px] text-muted">{line}</span>}
    </div>
  )
}

function Areas({ view }: { view: SpincrystalView }) {
  const area = useRealmListStore(s => s.area)
  const filter = useRealmListStore(s => s.filter)
  const { setArea, setFilter } = useRealmListStore.getState()
  const chips = [{ id: null, name: t.allAreas }, ...SPINCRYSTAL_AREAS]
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <fieldset aria-label={t.areas} className="flex flex-wrap gap-1.5">
        {chips.map(chip => {
          const rows = view.rows.filter(r => chip.id === null || r.info.area === chip.id)
          const done = rows.filter(r => r.status !== "none").length
          return (
            <FilterChip
              key={chip.id ?? "all"}
              pressed={area === chip.id}
              onPress={() => setArea(chip.id)}
            >
              {chip.name}
              <span
                className={cn(
                  "font-normal text-[12px] tabular",
                  area === chip.id
                    ? "text-accent-foreground/80"
                    : done === rows.length
                      ? "text-(--ok)"
                      : "text-muted",
                )}
              >
                {formatNumber(done)}/{formatNumber(rows.length)}
              </span>
            </FilterChip>
          )
        })}
      </fieldset>
      <Segmented
        label={t.filterLabel}
        value={filter}
        options={FILTERS.map(value => ({ value, label: t.filters[value] }))}
        onPick={setFilter}
      />
    </div>
  )
}

const STATUS_TONES: Record<string, string> = {
  placed: "text-(--ok)",
  bag: "text-(--warn)",
  none: "text-muted",
}

function Table({ view }: { view: SpincrystalView }) {
  const area = useRealmListStore(s => s.area)
  const filter = useRealmListStore(s => s.filter)
  const rows = view.rows.filter(
    r => (area === null || r.info.area === area) && (filter === "all" || r.status === filter),
  )
  return (
    <Panel className="p-2">
      {rows.length === 0 ? (
        <p className="p-3 text-[13px] text-muted">{t.noMatch}</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead className="text-left text-[12px] text-muted">
            <tr>
              <th className="px-2.5 py-1.5 font-normal">{t.columns.label}</th>
              <th className="px-2.5 py-1.5 font-normal">{t.columns.song}</th>
              <th className="px-2.5 py-1.5 font-normal">{t.columns.hint}</th>
              <th className="px-2.5 py-1.5 text-right font-normal">{t.columns.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ info, status }) => (
              <tr
                key={info.id}
                className={cn("border-border border-t", status === "placed" && "text-muted")}
              >
                <td className="px-2.5 py-1.5 tabular">{info.label}</td>
                <td className="px-2.5 py-1.5">{info.song ?? text.number.missing}</td>
                <td className="px-2.5 py-1.5 text-muted">{info.hint ?? text.number.missing}</td>
                <td className={cn("px-2.5 py-1.5 text-right", STATUS_TONES[status])}>
                  {t.status[status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
