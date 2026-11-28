// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronDown, CircleHelp, TriangleAlert } from "lucide-react"
import { useMemo } from "react"
import { Bar } from "@/components/Bar"
import { CheckboxField } from "@/components/CheckboxField"
import { FilterChip } from "@/components/FilterChip"
import { Notice } from "@/components/Notice"
import { Panel } from "@/components/Panel"
import { SearchBox } from "@/components/SearchBox"
import {
  ANECDOTE_AREAS,
  ANECDOTE_REWARD,
  ANECDOTE_RULES,
  ANECDOTE_TOTALS,
  type AnecdoteView,
  anecdoteName,
  anecdoteView,
  hasAnecdoteIn,
  PER_DAY,
} from "@/domain/anecdotes"
import { cn } from "@/lib/cn"
import { formatDateTime, formatMonthDay, formatNumber, formatTime } from "@/lib/format"
import { useCurrentAccount } from "@/stores/accountStore"
import { useAnecdoteListStore } from "@/stores/anecdoteListStore"
import { text } from "@/text"
import { AnecdoteBody } from "./AnecdoteBody"
import { AccountNotices, BackLink, InfoPopover } from "./parts"

const t = text.anecdotePage

/**
 * The anecdotes by character: what is recorded, the seals, how many days the
 * rest take at least, and what each one left says to look for. Back link,
 * header, notices, stats, areas and body are the page root's children, so
 * they rise in one after another.
 */
export function AnecdotesPage() {
  const { snapshot, account } = useCurrentAccount()
  const view = useMemo(() => (account ? anecdoteView(account) : undefined), [account])
  const lastWish = account?.anecdotes?.lastWish
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <BackLink />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="font-semibold text-[20px] leading-[1.3]">{t.title}</h1>
            {view && <LaumaChip hasLauma={view.hasLauma} />}
          </div>
          {view && snapshot && (
            <span className="text-[12px] text-muted tabular">
              {[
                t.summary(view.total, view.hidden),
                view.hasLauma ? t.hasLauma : t.noLauma,
                ...(lastWish
                  ? [t.lastWish(`${formatMonthDay(lastWish)} ${formatTime(lastWish)}`)]
                  : []),
                text.characters.snapshotAt(formatDateTime(snapshot.takenAt)),
              ].join(" · ")}
            </span>
          )}
        </div>
        {view && <Toolbar />}
      </div>
      <AccountNotices />
      {account && !view && <Notice title={t.notRead} />}
      {view && view.newer > 0 && <Notice title={text.collection.newer(view.newer)} />}
      {view?.seals.reward?.full && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-[12px] border border-(--warn) bg-(--warn)/10 px-3.5 py-2.5 text-[13px]"
        >
          <TriangleAlert size={16} aria-hidden className="flex-none text-(--warn)" />
          {t.full(view.seals.reward.target, ANECDOTE_REWARD.primogems)}
        </div>
      )}
      {view && <Stats view={view} />}
      {view && <Areas view={view} />}
      {view && <AnecdoteBody view={view} />}
    </div>
  )
}

function Toolbar() {
  const onlyTodo = useAnecdoteListStore(s => s.onlyTodo)
  const onlyHidden = useAnecdoteListStore(s => s.onlyHidden)
  const query = useAnecdoteListStore(s => s.query)
  const { setOnlyTodo, setOnlyHidden, setQuery } = useAnecdoteListStore.getState()
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <CheckboxField checked={onlyTodo} label={t.onlyTodo} onChange={setOnlyTodo} />
      <CheckboxField checked={onlyHidden} label={t.onlyHidden} onChange={setOnlyHidden} />
      <SearchBox value={query} label={t.search} onChange={setQuery} className="w-[170px]" />
    </div>
  )
}

/** Whether the account has Lauma, which changes two of Aino's; opens what the difference is. */
function LaumaChip({ hasLauma }: { hasLauma: boolean }) {
  const { lauma } = ANECDOTE_RULES
  const choice = anecdoteName(lauma.choice)
  const farewell = anecdoteName(lauma.farewell)
  const chip = hasLauma ? t.laumaChip.yes : t.laumaChip.no
  return (
    <InfoPopover
      label={t.laumaLabel(chip)}
      triggerClassName={cn(
        "h-[26px] min-w-0 gap-1.5 rounded-full border px-2.5 font-normal text-[12px] text-foreground",
        hasLauma ? "border-(--ok) bg-(--ok)/12" : "border-(--warn) bg-(--warn)/12",
      )}
      trigger={
        <>
          {chip}
          <ChevronDown size={13} aria-hidden />
        </>
      }
    >
      <b>{t.laumaTitle}</b>
      <span>{t.laumaAuto}</span>
      <span>{t.laumaWith(ANECDOTE_TOTALS.withLauma.entries, choice, farewell, lauma.seals)}</span>
      <span>
        {t.laumaWithout(ANECDOTE_TOTALS.withoutLauma.entries, choice, farewell, lauma.days)}
      </span>
      <span className="text-muted">
        {t.laumaSeals(ANECDOTE_TOTALS.withLauma.seals, ANECDOTE_TOTALS.withoutLauma.seals)}
      </span>
    </InfoPopover>
  )
}

function Stats({ view }: { view: AnecdoteView }) {
  const { seals, fastest } = view
  const reward = seals.reward
  return (
    <Panel
      aria-label={t.stats}
      className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 p-4"
    >
      <Stat
        label={t.done}
        value={view.recorded}
        of={view.total}
        bar={view.total > 0 ? view.recorded / view.total : 0}
        line={t.doneLine(view.waiting, view.unmet)}
      />
      <Stat
        label={t.seals}
        value={seals.earned}
        of={seals.total}
        bar={seals.earned !== undefined && seals.total > 0 ? seals.earned / seals.total : 0}
        gold
        line={
          reward
            ? reward.full
              ? t.sealsFull(reward.progress, reward.target)
              : t.sealsLine(reward.progress, reward.target, ANECDOTE_REWARD.primogems)
            : t.sealsNotRead
        }
        warn={reward?.full}
      />
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          {t.fastest}
          <HowPopover view={view} />
        </span>
        <span className="font-semibold text-[20px] tabular">
          {fastest.days > 0 ? t.fastestValue(fastest.days) : t.fastestDone}
        </span>
        <span className="text-[12px] text-muted tabular">
          {t.fastestLine(fastest.hidden, fastest.normal)}
        </span>
      </div>
    </Panel>
  )
}

type StatProps = {
  label: string
  value: number | undefined
  of: number
  bar: number
  line: string
  gold?: boolean
  warn?: boolean
}

function Stat({ label, value, of, bar, line, gold, warn }: StatProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="font-semibold text-[20px] tabular">
        {value === undefined ? text.number.missing : formatNumber(value)}{" "}
        <span className="font-normal text-[14px] text-muted">/ {formatNumber(of)}</span>
      </span>
      <Bar value={bar} tone={gold ? "gold" : "accent"} className="h-1.5" />
      <span className={cn("text-[12px] tabular", warn ? "text-(--warn)" : "text-muted")}>
        {line}
      </span>
    </div>
  )
}

/** How the totals, the seals and the fastest estimate are worked out, from the rules and counts. */
function HowPopover({ view }: { view: AnecdoteView }) {
  const { daily, lauma } = ANECDOTE_RULES
  const { fastest } = view
  const chain = fastest.chain && t.chain(fastest.chain.ids.map(anecdoteName))
  const name = (id: number) => anecdoteName(id)
  return (
    <InfoPopover
      label={t.howTitle}
      triggerClassName="size-5 min-w-0 rounded-full p-0 text-(--accent-text)"
      trigger={<CircleHelp size={14} aria-hidden />}
    >
      <b>{t.howTitle}</b>
      <span>
        {t.howTotal(
          ANECDOTE_TOTALS.withLauma.entries,
          ANECDOTE_TOTALS.hidden,
          ANECDOTE_TOTALS.withoutLauma.entries,
          name(lauma.farewell),
          view.hasLauma,
        )}
      </span>
      <span>
        {t.howSeals(
          name(daily.id),
          name(daily.last),
          daily.total,
          name(lauma.choice),
          name(lauma.farewell),
          lauma.seals,
          lauma.days,
          ANECDOTE_TOTALS.withLauma.seals,
          ANECDOTE_TOTALS.withoutLauma.seals,
          ANECDOTE_REWARD.seals,
          ANECDOTE_REWARD.primogems,
        )}
      </span>
      <span>
        {t.howFastest(
          fastest.hidden,
          fastest.normal,
          PER_DAY,
          Math.ceil(fastest.normal / PER_DAY),
          chain,
          fastest.chain?.days ?? 0,
          fastest.days,
        )}
      </span>
      <span className="text-muted">{t.howNote}</span>
    </InfoPopover>
  )
}

/**
 * Every area with its recorded and total, greyed until the account unlocks its page. Picking
 * one lets go of a character who has no anecdote there.
 */
function Areas({ view }: { view: AnecdoteView }) {
  const area = useAnecdoteListStore(s => s.area)
  const character = useAnecdoteListStore(s => s.character)
  const { setArea, setCharacter } = useAnecdoteListStore.getState()
  const pick = (id: number | null) => {
    setArea(id)
    if (id !== null && character !== null && !hasAnecdoteIn(view.rows, character, id)) {
      setCharacter(null)
    }
  }
  // An export that lists no unlocked area greys none.
  const unlocked = view.unlockedAreas.size > 0 ? view.unlockedAreas : null
  const counted = view.rows.filter(r => r.status !== "absent")
  const chips = [
    { id: null, name: text.anecdotePage.allAreas, rows: counted },
    ...ANECDOTE_AREAS.map(a => ({ ...a, rows: counted.filter(r => r.info.area === a.id) })),
  ]
  return (
    <fieldset aria-label={t.areas} className="flex flex-wrap gap-1.5">
      {chips.map(chip => {
        const done = chip.rows.filter(r => r.recorded).length
        const total = chip.rows.length
        const locked = chip.id !== null && unlocked !== null && !unlocked.has(chip.id)
        return (
          <FilterChip
            key={chip.id ?? "all"}
            pressed={area === chip.id}
            onPress={() => pick(chip.id)}
            className={cn(locked && area !== chip.id && "opacity-50")}
          >
            {chip.name}
            <span
              className={cn(
                "font-normal text-[12px] tabular",
                area === chip.id
                  ? "text-accent-foreground/80"
                  : done === total && total > 0
                    ? "text-(--ok)"
                    : "text-muted",
              )}
            >
              {formatNumber(done)}/{formatNumber(total)}
            </span>
          </FilterChip>
        )
      })}
    </fieldset>
  )
}
