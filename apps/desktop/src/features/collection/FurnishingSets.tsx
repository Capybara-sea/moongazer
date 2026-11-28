// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronDown } from "lucide-react"
import { GameIcon } from "@/components/GameIcon"
import { Panel } from "@/components/Panel"
import { iconTone } from "@/components/RarityChip"
import {
  byCharacter,
  COMPANION_PRIMOGEMS,
  type FurnishingView,
  type SetRow,
} from "@/domain/furnishing"
import { lookup } from "@/domain/names"
import { cn } from "@/lib/cn"
import { useRealmListStore } from "@/stores/realmListStore"
import { lang, text } from "@/text"
import { SetDetail } from "./FurnishingDetail"

const t = text.furnishingPage

/** The companions whose reward can be claimed: owned, not claimed yet. */
function claimable(row: SetRow) {
  return row.companions.filter(c => c.status === "claimable")
}

/** Whether a name holds the search, `query` in lower case. */
const has = (name: string, query: string) => name.toLowerCase().includes(query)

/** The sets with a reward left to claim, as the search leaves them. */
function useShownRows(rows: SetRow[]) {
  const query = useRealmListStore(s => s.query)
    .trim()
    .toLowerCase()
  return rows.filter(
    row =>
      row.claimable > 0 &&
      (!query ||
        has(row.info.name, query) ||
        claimable(row).some(c => has(lookup("characters", c.character).name, query))),
  )
}

/** What an empty list says: nothing left to claim, or nothing the search finds. */
function Empty({ claimable }: { claimable: number }) {
  return <p className="p-3 text-[13px] text-muted">{claimable > 0 ? t.none : t.allClaimed}</p>
}

export function SetList({ view }: { view: FurnishingView }) {
  const rows = useShownRows(view.rows)
  const open = useRealmListStore(s => s.open)
  const { setOpen } = useRealmListStore.getState()
  return (
    <Panel className="gap-0 p-2">
      {rows.length === 0 && <Empty claimable={view.claimable} />}
      {rows.map(row => {
        const opened = open === row.info.id
        return (
          <div key={row.info.id} className="border-border border-b last:border-b-0">
            <button
              type="button"
              aria-expanded={opened}
              onClick={() => setOpen(opened ? null : row.info.id)}
              className="grid w-full cursor-pointer grid-cols-[44px_minmax(140px,1fr)_200px_300px_72px_16px] items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-surface-secondary motion-reduce:transition-none"
            >
              <GameIcon
                icon={row.info.icon}
                label={row.info.name}
                className={cn("size-11 rounded-[10px]", iconTone(4))}
              />
              <SetName row={row} />
              <SetState row={row} bag={view.bag} />
              <span className="flex flex-wrap justify-end gap-1.5">
                {claimable(row).map(c => (
                  <Companion key={c.event} character={c.character} />
                ))}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-right font-semibold text-(--gold-fg) text-[13px] tabular",
                  lang === "en" ? "w-[104px]" : "w-[72px]",
                )}
              >
                {t.claimable(row.claimable * COMPANION_PRIMOGEMS)}
              </span>
              <ChevronDown
                size={16}
                aria-hidden
                className={cn(
                  "text-muted transition-transform motion-reduce:transition-none",
                  opened && "rotate-180",
                )}
              />
            </button>
            {opened && <SetDetail row={row} bag={view.bag} />}
          </div>
        )
      })}
    </Panel>
  )
}

function SetName({ row }: { row: SetRow }) {
  const pieces = row.units.reduce((sum, u) => sum + u.need, 0)
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-semibold text-[14px]">{row.info.name}</span>
      <span className={cn("text-[12px] tabular", row.learned ? "text-muted" : "text-(--warn)")}>
        {row.learned
          ? `${row.info.outdoor ? t.outdoor : t.indoor} · ${t.kinds(row.units.length, pieces)}`
          : t.notLearned}
      </span>
    </span>
  )
}

/** Whether the bag holds the set whole; without the bag, how many kinds can be made. */
function SetState({ row, bag }: { row: SetRow; bag: boolean }) {
  if (!bag || !row.short) {
    const craft = row.units.filter(u => u.getting === "craft").length
    return <span className="text-[12px] text-muted tabular">{t.craftableKinds(craft)}</span>
  }
  if (row.short.kinds === 0) {
    return <span className="text-(--ok) text-[13px]">{t.complete}</span>
  }
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-[13px] tabular">{t.short(row.short.kinds, row.short.pieces)}</span>
      <span className="truncate text-[12px] text-muted tabular">
        {t.shortHow(row.short.buy, row.short.blueprint)}
      </span>
    </span>
  )
}

/** A companion who still gives primogems for the set, ringed in gold; the tip names it. */
function Companion({ character }: { character: string }) {
  const { name, icon } = lookup("characters", character)
  return (
    <GameIcon
      icon={icon}
      label={name}
      className="size-7 rounded-full bg-surface-secondary ring-(--gold-fg) ring-2"
    />
  )
}

/** Each owned character with rewards left to claim, and the sets they are for; most first. */
export function CharacterList({ view }: { view: FurnishingView }) {
  const query = useRealmListStore(s => s.query)
    .trim()
    .toLowerCase()
  const people = byCharacter(view.rows).filter(
    p =>
      !query ||
      has(lookup("characters", p.character).name, query) ||
      p.sets.some(set => has(set.info.name, query)),
  )
  if (people.length === 0) {
    return (
      <Panel className="p-2">
        <Empty claimable={view.claimable} />
      </Panel>
    )
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
      {people.map(p => {
        const { name, icon } = lookup("characters", p.character)
        return (
          <Panel key={p.character} className="gap-2.5 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <GameIcon
                icon={icon}
                label={name}
                className="size-9 rounded-full bg-surface-secondary"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-[14px]">{name}</span>
                <span className="text-(--gold-fg) text-[12px] tabular">
                  {t.characterClaimable(p.sets.length, p.sets.length * COMPANION_PRIMOGEMS)}
                </span>
              </span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {p.sets.map(set => (
                <li
                  key={set.info.id}
                  className="rounded-[8px] border border-(--gold-fg) px-2 py-0.5 text-[12px]"
                >
                  {set.info.name}
                </li>
              ))}
            </ul>
          </Panel>
        )
      })}
    </div>
  )
}
