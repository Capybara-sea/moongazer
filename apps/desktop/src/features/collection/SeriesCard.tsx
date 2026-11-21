// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { toast } from "@heroui/react"
import { Check, Search } from "lucide-react"
import { GameIcon } from "@/components/GameIcon"
import { type AchievementRow, type AchievementSeries, descShown } from "@/domain/achievements"
import { lookup } from "@/domain/names"
import { openVideoSearch, toBackendError } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { formatDateTime, formatNumber } from "@/lib/format"
import { text } from "@/text/zh"

const t = text.achievementPage
const PRIMOGEM = lookup("materials", "Primogem")

type Props = {
  series: AchievementSeries
  showHidden: boolean
  /** Shown after the first tier's title where every goal is listed. */
  goalName: string | undefined
}

/** One achievement's tiers, a row each, in a card. */
export function SeriesCard({ series, showHidden, goalName }: Props) {
  const [first] = series.rows
  const quest = first?.info.quest && t.quest[first.info.quest]
  return (
    <article className="glass flex flex-col rounded-[12px] border border-border bg-surface">
      {series.rows.map((row, i) => (
        <Tier
          key={row.info.id}
          row={row}
          showHidden={showHidden}
          lead={i === 0}
          quest={i === 0 ? quest : undefined}
          goalName={i === 0 ? goalName : undefined}
          version={
            i === 0 || row.info.version !== first?.info.version ? row.info.version : undefined
          }
        />
      ))}
    </article>
  )
}

type TierProps = {
  row: AchievementRow
  showHidden: boolean
  lead: boolean
  quest?: string
  goalName?: string
  /** On the first tier, and on a later one only where it differs. */
  version?: string
}

/** The tags after a title, as on the anecdotes page; only the quest's kind is in colour. */
const TAG = "flex-none rounded-full border px-[7px] text-[11px] leading-[18px]"
const PLAIN = cn(TAG, "border-border text-muted")

function Tier({ row, showHidden, lead, quest, goalName, version }: TierProps) {
  const { info } = row
  const count =
    row.current !== undefined && row.shownTarget !== undefined
      ? `${formatNumber(row.current)} / ${formatNumber(row.shownTarget)}`
      : undefined
  return (
    <div
      className={cn(
        "grid grid-cols-[26px_52px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3",
        !lead && "border-(--separator) border-t",
      )}
    >
      <span
        role="img"
        aria-label={row.done ? t.done : t.notDone}
        className={cn(
          "flex size-[26px] items-center justify-center rounded-full border-2",
          row.done ? "border-accent bg-accent text-(--on-accent)" : "border-border",
        )}
      >
        {row.done && <Check size={14} strokeWidth={3} aria-hidden />}
      </span>
      <span
        role="img"
        aria-label={t.primogems(info.primogems)}
        className={cn(
          "flex h-6 items-center justify-center gap-1 rounded-[6px] border border-accent font-semibold text-[12px] tabular",
          row.done ? "bg-accent text-(--on-accent)" : "text-(--accent-text)",
        )}
      >
        <GameIcon icon={PRIMOGEM.icon} label={PRIMOGEM.name} className="size-3.5 text-[9px]" />
        {info.primogems}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <b className="text-sm">{info.title}</b>
          {quest && (
            <span className={cn(TAG, "border-transparent bg-(--accent-soft) text-(--accent-text)")}>
              {quest}
            </span>
          )}
          {info.hidden && <span className={PLAIN}>{t.hidden}</span>}
          {goalName && <span className={PLAIN}>{goalName}</span>}
          {version && (
            <span title={t.version(version)} className={cn(PLAIN, "tabular")}>
              {version}
            </span>
          )}
          {lead && <SearchButton title={info.title} />}
        </span>
        <span className="text-[13px] text-muted">
          {descShown(row, showHidden) ? info.desc : t.hiddenDesc}
        </span>
      </span>
      <span className="flex flex-col items-end gap-0.5 text-right text-[12px] text-muted tabular">
        {count && <span>{count}</span>}
        {row.done && row.at !== undefined && <span>{formatDateTime(row.at)}</span>}
      </span>
    </div>
  )
}

/** Opens Bilibili's video search for the achievement in the browser. */
function SearchButton({ title }: { title: string }) {
  const label = t.searchVideo(title)
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        openVideoSearch(t.searchKeyword(title)).catch((error: unknown) => {
          toast(t.searchFailed, { description: toBackendError(error).message })
        })
      }}
      className="flex size-5 flex-none cursor-pointer items-center justify-center self-center rounded-[5px] text-muted transition-colors duration-150 hover:bg-default/60 hover:text-foreground motion-reduce:transition-none"
    >
      <Search size={13} aria-hidden />
    </button>
  )
}
