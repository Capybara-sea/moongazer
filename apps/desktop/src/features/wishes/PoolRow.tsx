// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"
import { GameIcon } from "@/components/GameIcon"
import { iconTone } from "@/components/RarityChip"
import { Tip } from "@/components/Tip"
import { HARD_PITY, luckOf, type PoolSummary, type Pull } from "@/domain/wishes"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { formatDate, formatDateTime, formatNumber, formatTimeWithSeconds } from "@/lib/format"
import { itemView, LUCK_TONES, TAG_TONES } from "./items"

const t = text.wishes

type Chip = { label: string; tip: string; tone: string }

const ACCENT = "bg-(--accent-soft) text-(--accent-text)"
const PLAIN = "text-muted shadow-[inset_0_0_0_1px_var(--border)]"
const GOLD = "bg-(--gold-bg) text-(--gold-fg)"

type Props = {
  pool: PoolSummary
  /** The Epitomized Path's points as the snapshot has them, and when it was read. */
  fate: { points: number; at?: number }
  onOpen: () => void
}

/**
 * One pool on one line of even height: its name, pity and state on the left;
 * on the right the five-stars or four-stars, newest first, each with the
 * wish it came on, the pity first.
 */
export function PoolRow({ pool, fate, onOpen }: Props) {
  const [rank, setRank] = useState<4 | 5>(5)
  const name = t.pools[pool.key]
  const of = HARD_PITY[pool.key]
  const novice = pool.key === "novice"
  const fives = pool.fives.length
  const fours = pool.fours.length
  const range =
    pool.first !== undefined && pool.last !== undefined
      ? t.row.range(formatDate(pool.first), formatDate(pool.last))
      : t.row.empty
  return (
    <section
      aria-label={name}
      className="glass grid h-[152px] grid-cols-[256px_minmax(0,1fr)] overflow-hidden rounded-[14px] border border-border bg-surface max-[720px]:h-auto max-[720px]:grid-cols-1"
    >
      <div className="flex flex-col gap-1.5 border-(--separator) border-r px-4 py-3">
        <div className="flex items-baseline gap-2">
          <b className="font-semibold text-[15px]">{name}</b>
          <span className="ml-auto font-semibold text-[18px] tabular">
            {formatNumber(pool.total)}
            <span className="font-normal text-[12px] text-muted"> {t.row.pulls}</span>
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] text-muted">{novice ? t.row.made : t.row.pity}</span>
          <span className="font-semibold text-[28px] leading-[1.05] tabular">{pool.pity}</span>
          <span className="text-[12px] text-muted tabular">/ {of}</span>
        </div>
        <span aria-hidden className="block h-1 rounded-full bg-(--separator)">
          <span
            className="block h-1 rounded-full bg-(--gold-fg)"
            style={{ width: `${Math.min(100, (pool.pity / of) * 100)}%` }}
          />
        </span>
        <div className="flex min-h-[18px] flex-wrap gap-1">
          {chips(pool, fate).map(chip => (
            <Tip
              key={chip.label}
              content={chip.tip}
              className={cn(
                "whitespace-nowrap rounded-full px-[7px] text-[11px] leading-[18px]",
                chip.tone,
              )}
            >
              {chip.label}
            </Tip>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2">
          <span className="min-w-0 truncate text-[11px] text-muted tabular">{range}</span>
          <button
            type="button"
            onClick={onOpen}
            className="ml-auto h-6 flex-none cursor-pointer rounded-[7px] border border-border px-2 text-[12px] hover:bg-default/60"
          >
            {t.row.all}
          </button>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-3 px-3 py-3">
        <div
          role="tablist"
          aria-label={t.row.rarityLabel(name)}
          aria-orientation="vertical"
          className="flex w-[164px] flex-none flex-col gap-1 tabular"
        >
          {(
            [
              [5, fives, "bg-(--gold-fg)", "text-(--gold-fg)", t.row.five],
              [4, fours, "bg-(--purple-fg)", "text-(--purple-fg)", t.row.four],
            ] as const
          ).map(([r, count, dot, tone, label]) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={rank === r}
              onClick={() => setRank(r)}
              className={cn(
                "flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2.5 text-left text-[12px] transition-colors",
                rank === r
                  ? "bg-surface-secondary shadow-[inset_0_0_0_1px_var(--border)]"
                  : "hover:bg-default/60",
              )}
            >
              <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
              <span className={tone}>{label}</span>
              <b className="ml-auto font-semibold text-[14px]">{count}</b>
              <span className="w-[54px] text-right text-[11px] text-muted">
                {pool.total > 0 ? t.row.rate(count / pool.total) : ""}
              </span>
            </button>
          ))}
          <div className="flex h-7 items-center gap-2 px-2.5 text-[12px]">
            <span aria-hidden className="size-1.5 rounded-full bg-muted" />
            <span className="text-muted">{t.row.average}</span>
            <b className="ml-auto font-semibold text-[14px]">
              {pool.average === undefined ? text.number.missing : pool.average.toFixed(1)}
            </b>
            <span className="w-[54px] text-right text-[11px] text-muted">
              {pool.averageUp === undefined ? "" : t.row.averageUp(pool.averageUp.toFixed(1))}
            </span>
          </div>
        </div>
        <span aria-hidden className="w-px flex-none self-stretch bg-(--separator)" />
        <Strip pool={pool} rank={rank} label={t.row.strip(name)} />
      </div>
    </section>
  )
}

function chips(pool: PoolSummary, fate: Props["fate"]): Chip[] {
  const list: Chip[] = []
  if (pool.key === "character" || pool.key === "weapon") {
    const weapon = pool.key === "weapon"
    list.push(
      pool.guaranteed
        ? {
            label: t.row.guaranteed,
            tip: weapon ? t.row.guaranteedWeaponTip : t.row.guaranteedTip,
            tone: ACCENT,
          }
        : { label: t.row.small, tip: weapon ? t.row.smallWeaponTip : t.row.smallTip, tone: PLAIN },
    )
    if (weapon) {
      list.push({
        label: t.row.fate(fate.points),
        tip: fate.at === undefined ? t.row.fateGuess : t.row.fateRead(formatDateTime(fate.at)),
        tone: PLAIN,
      })
    } else {
      list.push({
        label: t.row.radiance(pool.radiance),
        tip: t.row.radianceTip(pool.radiance),
        tone: GOLD,
      })
    }
  }
  if (pool.key === "chronicled" && pool.total > 0 && pool.fives.length === 0) {
    list.push({ label: t.row.noFive, tip: t.row.noFive, tone: PLAIN })
  }
  if (pool.key === "novice" && pool.pity >= HARD_PITY.novice) {
    list.push({ label: t.row.noviceDone, tip: t.row.noviceDone, tone: PLAIN })
  }
  return list
}

function Strip({ pool, rank, label }: { pool: PoolSummary; rank: 4 | 5; label: string }) {
  const list = rank === 5 ? pool.fives : pool.fours
  const of = HARD_PITY[pool.key]
  const current = rank === 5 && pool.key !== "novice"
  return (
    <ol
      aria-label={label}
      className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto overflow-y-hidden pb-0.5 [scrollbar-width:thin]"
    >
      {current && (
        <Tip
          as="li"
          content={t.row.currentTip(pool.pity)}
          className="flex w-[50px] flex-none flex-col items-center gap-1"
        >
          <span
            aria-hidden
            className="flex size-[46px] items-center justify-center rounded-[12px] border-[1.5px] border-border border-dashed text-muted"
          >
            ?
          </span>
          <span className="min-w-8 rounded-[6px] px-1.5 text-center font-semibold text-(--gold-fg) text-[13px] leading-5 shadow-[inset_0_0_0_1px_var(--gold-fg)] tabular">
            {pool.pity}
          </span>
          <span className="h-[15px] text-[10px] text-muted leading-[15px]">{t.row.current}</span>
        </Tip>
      )}
      {list.map(pull => (
        <PullItem key={pull.id} pull={pull} of={rank === 5 ? of : 10} rank={rank} />
      ))}
      {list.length === 0 && (
        <li className="self-center px-3 text-[12px] text-muted">
          {rank === 5 ? t.row.none5 : t.row.none4}
        </li>
      )}
    </ol>
  )
}

/** A pull's hover text: the item, and when it was pulled to the second. */
export function PullTip({ name, time }: { name: string; time: number }) {
  return (
    <span className="flex flex-col">
      <span>{name}</span>
      <span className="text-muted tabular">
        {formatDate(time)} {formatTimeWithSeconds(time)}
      </span>
    </span>
  )
}

function PullItem({ pull, of, rank }: { pull: Pull; of: number; rank: 4 | 5 }) {
  const { name, icon } = itemView(pull.itemId, pull.name)
  const tag = pull.tag
  return (
    <Tip
      as="li"
      content={<PullTip name={name} time={pull.time} />}
      className="flex w-[50px] flex-none flex-col items-center gap-1"
    >
      <GameIcon
        icon={icon}
        label={name}
        className={cn("size-[46px] rounded-[12px] text-[13px]", iconTone(rank))}
      />
      <span
        className={cn(
          "min-w-8 rounded-[6px] px-1.5 text-center font-semibold text-[13px] leading-5 tabular",
          rank === 5 ? LUCK_TONES[luckOf(pull.pity, of)] : "bg-(--purple-bg)",
        )}
      >
        {pull.pity}
      </span>
      <span
        className={cn(
          "h-[15px] whitespace-nowrap rounded-[4px] px-1 text-[10px] leading-[15px]",
          tag && TAG_TONES[tag],
        )}
      >
        {tag ? t.tags[tag] : ""}
      </span>
    </Tip>
  )
}
