// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Trophy } from "lucide-react"
import { memo, useMemo } from "react"
import { Bar } from "@/components/Bar"
import { CheckboxField } from "@/components/CheckboxField"
import { EmptyState } from "@/components/EmptyState"
import { FilterChip } from "@/components/FilterChip"
import { GameIcon } from "@/components/GameIcon"
import { Notice } from "@/components/Notice"
import { SearchBox } from "@/components/SearchBox"
import {
  ACHIEVEMENT_GOALS,
  type AchievementFilter,
  type AchievementView,
  achievementView,
  filterCounts,
  visibleSeries,
} from "@/domain/achievements"
import { cn } from "@/lib/cn"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useBatches } from "@/lib/useBatches"
import { useCurrentAccount } from "@/stores/accountStore"
import { useAchievementListStore } from "@/stores/achievementListStore"
import { text } from "@/text/zh"
import { AccountNotices, BackLink } from "./parts"
import { SeriesCard } from "./SeriesCard"

const t = text.achievementPage
const FILTERS: AchievementFilter[] = ["all", "done", "todo"]
const GOAL_NAMES = new Map(ACHIEVEMENT_GOALS.map(g => [g.id, g.name]))
/** Cards already drawn are skipped when the filters change. */
const Card = memo(SeriesCard)

/**
 * The achievements by goal, each series of tiers in one card: done or not,
 * the primogems, the count where known and when it was finished. Back link,
 * header, toolbar and body are the page root's children, so they rise in one
 * after another.
 */
export function AchievementsPage() {
  const { snapshot, account } = useCurrentAccount()
  const view = useMemo(
    () => (account?.achievements ? achievementView(account.achievements) : undefined),
    [account],
  )
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <BackLink />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="font-semibold text-[20px] leading-[1.3]">{t.title}</h1>
          {view && snapshot && (
            <span className="text-[12px] text-muted tabular">
              {[
                t.summary(view.done, view.total, view.primogems.earned, view.primogems.total),
                text.characters.snapshotAt(formatDateTime(snapshot.takenAt)),
              ].join(" · ")}
            </span>
          )}
        </div>
        {view && (
          <div className="flex gap-2.5">
            <Stat label={t.todo} value={t.todoValue(view.total - view.done)} />
            <Stat
              label={t.primogemsLeft}
              value={formatNumber(view.primogems.total - view.primogems.earned)}
              gold
            />
          </div>
        )}
      </div>
      <AccountNotices />
      {account && !view && <Notice title={t.notRead} />}
      {view && view.newer > 0 && <Notice title={text.collection.newer(view.newer)} />}
      {view && <Toolbar view={view} />}
      {view && <Body view={view} />}
    </div>
  )
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="glass flex min-w-[150px] flex-col gap-0.5 rounded-[12px] border border-border bg-surface px-3 py-2">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={cn("font-semibold text-base tabular", gold && "text-(--gold-fg)")}>
        {value}
      </span>
    </div>
  )
}

/** Done or not, with the counts of the goal shown; the search; hidden descriptions. */
function Toolbar({ view }: { view: AchievementView }) {
  const goal = useAchievementListStore(s => s.goal)
  const filter = useAchievementListStore(s => s.filter)
  const query = useAchievementListStore(s => s.query)
  const showHidden = useAchievementListStore(s => s.showHidden)
  const { setFilter, setQuery, setShowHidden } = useAchievementListStore.getState()
  const counts = filterCounts(view, goal)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <fieldset aria-label={t.byState} className="flex flex-wrap gap-1.5">
        {FILTERS.map(option => (
          <FilterChip key={option} pressed={filter === option} onPress={() => setFilter(option)}>
            {t.filters[option]}
            <span
              className={cn(
                "font-normal text-[12px] tabular",
                filter === option ? "text-accent-foreground/80" : "text-muted",
              )}
            >
              {formatNumber(counts[option])}
            </span>
          </FilterChip>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={query} label={t.search} onChange={setQuery} className="w-[180px]" />
        <CheckboxField checked={showHidden} label={t.showHidden} onChange={setShowHidden} />
      </div>
    </div>
  )
}

/** The goals on the left, the chosen goal's series on the right. */
function Body({ view }: { view: AchievementView }) {
  const goal = useAchievementListStore(s => s.goal)
  const filter = useAchievementListStore(s => s.filter)
  const query = useAchievementListStore(s => s.query)
  const showHidden = useAchievementListStore(s => s.showHidden)
  const matched = useMemo(
    () => visibleSeries(view, { goal: null, filter, query, showHidden }),
    [view, filter, query, showHidden],
  )
  // The goals the filter and the search leave something in; the others are not listed.
  const hits = useMemo(() => new Set(matched.map(s => s.goal)), [matched])
  // A goal this snapshot does not have, or one left empty, shows every goal.
  const shownGoal = goal !== null && view.goals.has(goal) && hits.has(goal) ? goal : null
  const series = useMemo(
    () => (shownGoal === null ? matched : matched.filter(s => s.goal === shownGoal)),
    [matched, shownGoal],
  )
  const { visible, more, sentinel } = useBatches(series)
  const counts = filterCounts(view, shownGoal)
  const name = shownGoal === null ? t.allGoals : (GOAL_NAMES.get(shownGoal) ?? "")
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Goals view={view} goal={shownGoal} hits={hits} />
      <section aria-label={name} className="flex min-w-0 flex-[999_1_520px] flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold text-[15px]">{name}</h2>
          <span className="text-[12px] text-muted tabular">
            {t.goalInfo(counts.done, counts.all)}
          </span>
        </div>
        {series.length === 0 ? (
          <EmptyState>{t.none}</EmptyState>
        ) : (
          visible.map(s => (
            <Card
              key={s.rows[0]?.info.id}
              series={s}
              showHidden={showHidden}
              goalName={shownGoal === null ? GOAL_NAMES.get(s.goal) : undefined}
            />
          ))
        )}
        {more && <div ref={sentinel} aria-hidden className="h-px" />}
      </section>
    </div>
  )
}

type GoalsProps = { view: AchievementView; goal: number | null; hits: Set<number> }

function Goals({ view, goal, hits }: GoalsProps) {
  const { setGoal } = useAchievementListStore.getState()
  // Scrolled to the top again so a long list does not open halfway.
  const scrollTop = () => {
    const page = document.querySelector('section[data-page="collection"]')
    if (page) page.scrollTop = 0
  }
  const rows: { id: number | null; name: string; icon?: string; done: number; total: number }[] = [
    { id: null, name: t.allGoals, done: view.done, total: view.total },
    ...ACHIEVEMENT_GOALS.flatMap(g => {
      const counts = view.goals.get(g.id)
      return counts && hits.has(g.id) ? [{ id: g.id, name: g.name, icon: g.icon, ...counts }] : []
    }),
  ]
  return (
    <aside
      aria-label={t.goals}
      className="glass flex max-w-[300px] flex-[1_1_260px] flex-col gap-0.5 rounded-[14px] border border-border bg-surface p-2"
    >
      {rows.map(row => {
        const current = row.id === goal
        return (
          <button
            key={row.id ?? "all"}
            type="button"
            aria-current={current ? "true" : undefined}
            onClick={() => {
              setGoal(row.id)
              scrollTop()
            }}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-[8px] px-2.5 py-2 text-left transition-colors duration-150 motion-reduce:transition-none",
              current ? "bg-(--accent-soft)" : "hover:bg-default/60",
            )}
          >
            <span className="flex w-full items-center gap-2">
              {row.icon ? (
                <GameIcon icon={row.icon} label={row.name} className="size-7 text-[11px]" />
              ) : (
                <span
                  aria-hidden
                  className="flex size-7 flex-none items-center justify-center text-(--accent-text)"
                >
                  <Trophy size={16} />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[13px]">{row.name}</span>
              <span className="text-[12px] text-muted tabular">
                {formatNumber(row.done)} / {formatNumber(row.total)}
              </span>
            </span>
            <Bar value={row.total > 0 ? row.done / row.total : 0} className="h-[3px]" />
          </button>
        )
      })}
    </aside>
  )
}
