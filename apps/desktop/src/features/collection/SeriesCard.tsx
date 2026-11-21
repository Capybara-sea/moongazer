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

/** One achievement's tiers, a row each, in a card; the quest badge sits in its corner. */
export function SeriesCard({ series, showHidden, goalName }: Props) {
  const [first] = series.rows
  const quest = first?.info.quest && t.quest[first.info.quest]
  return (
    <article className="glass relative flex flex-col rounded-[12px] border border-border bg-surface">
      {quest && (
        <span className="absolute top-0 right-0 rounded-tr-[11px] rounded-bl-[8px] bg-(--accent-soft) px-2.5 py-px text-(--accent-text) text-[11px]">
          {quest}
        </span>
      )}
      {series.rows.map((row, i) => (
        <Tier
          key={row.info.id}
          row={row}
          showHidden={showHidden}
          lead={i === 0}
          goalName={i === 0 ? goalName : undefined}
        />
      ))}
    </article>
  )
}

type TierProps = { row: AchievementRow; showHidden: boolean; lead: boolean; goalName?: string }

function Tier({ row, showHidden, lead, goalName }: TierProps) {
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
        <span className="flex min-w-0 items-baseline gap-1.5">
          <b className="truncate text-sm">{info.title}</b>
          {info.version && (
            <sup title={t.version(info.version)} className="text-(--accent-text) text-[11px]">
              {info.version}
            </sup>
          )}
          {info.hidden && <span className="flex-none text-[11px] text-muted">{t.hidden}</span>}
          {goalName && <span className="flex-none text-[11px] text-muted">{goalName}</span>}
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
