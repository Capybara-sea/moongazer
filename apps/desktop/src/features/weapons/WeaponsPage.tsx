// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { LayoutGrid, type LucideIcon, Table } from "lucide-react"
import { useMemo } from "react"
import { CheckboxField } from "@/components/CheckboxField"
import { EmptyState } from "@/components/EmptyState"
import { FilterChip } from "@/components/FilterChip"
import { LabeledSelect } from "@/components/LabeledSelect"
import { Notice } from "@/components/Notice"
import { ShownCount } from "@/components/ShownCount"
import { ViewToggle } from "@/components/ViewToggle"
import { WEAPON_TYPES } from "@/domain/elements"
import { useEmptyBody } from "@/features/overview/emptyBody"
import { text } from "@/i18n"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useCurrentAccount } from "@/stores/accountStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { useWeaponListStore, type WeaponView } from "@/stores/weaponListStore"
import { visibleWeapons, WEAPON_SORTS, type WeaponRow, weaponCounts, weaponRows } from "./order"
import { WeaponCards } from "./WeaponCards"
import { WeaponTable } from "./WeaponTable"

const t = text.weapons

const VIEWS: readonly { value: WeaponView; label: string; icon: LucideIcon }[] = [
  { value: "cards", label: text.views.cards, icon: LayoutGrid },
  { value: "table", label: text.views.table, icon: Table },
]

/**
 * The weapons: header, type filter, the unequipped toggle, sort and view,
 * then the table or the cards. Blocks are direct children of the page's root
 * so they rise in one after another.
 */
export function WeaponsPage() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  const emptyBody = useEmptyBody()
  const { snapshot, entry, account } = useCurrentAccount()
  const rows = useMemo(() => account && weaponRows(account.weapons), [account])
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
      {rows && (rows.length === 0 ? <EmptyState>{t.empty}</EmptyState> : <Weapons rows={rows} />)}
    </div>
  )
}

function subtitle(rows: readonly WeaponRow[], takenAt: number) {
  const { total, five, four, equipped } = weaponCounts(rows)
  return [
    t.summary(formatNumber(total), formatNumber(five), formatNumber(four), formatNumber(equipped)),
    text.characters.snapshotAt(formatDateTime(takenAt)),
  ].join(" · ")
}

/** The toolbar and the table or the cards. */
function Weapons({ rows }: { rows: readonly WeaponRow[] }) {
  const type = useWeaponListStore(s => s.type)
  const onlyFree = useWeaponListStore(s => s.onlyFree)
  const sort = useWeaponListStore(s => s.sort)
  const view = useWeaponListStore(s => s.view)
  const shown = useMemo(
    () => visibleWeapons(rows, { type, onlyFree, sort }),
    [rows, type, onlyFree, sort],
  )
  const { setOnlyFree, setSort, setView } = useWeaponListStore.getState()
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TypeFilter />
        <div className="flex flex-wrap items-center gap-3">
          <CheckboxField checked={onlyFree} label={t.onlyFree} onChange={setOnlyFree} />
          <LabeledSelect
            label={t.sort}
            value={sort}
            options={WEAPON_SORTS.map(option => ({ value: option, label: t.sorts[option] }))}
            onChange={value => {
              const picked = WEAPON_SORTS.find(option => option === value)
              if (picked) setSort(picked)
            }}
          />
          <ViewToggle label={text.views.label} value={view} options={VIEWS} onChange={setView} />
          <ShownCount shown={shown.length} total={rows.length} format={t.shown} />
        </div>
      </div>
      {view === "cards" ? <WeaponCards rows={shown} /> : <WeaponTable rows={shown} />}
    </>
  )
}

function TypeFilter() {
  const type = useWeaponListStore(s => s.type)
  const { setType } = useWeaponListStore.getState()
  return (
    <fieldset aria-label={t.byType} className="flex flex-wrap gap-1.5">
      <FilterChip pressed={type === null} onPress={() => setType(null)}>
        {t.all}
      </FilterChip>
      {WEAPON_TYPES.map(option => (
        <FilterChip key={option} pressed={type === option} onPress={() => setType(option)}>
          {text.game.weaponTypes[option]}
        </FilterChip>
      ))}
    </fieldset>
  )
}
