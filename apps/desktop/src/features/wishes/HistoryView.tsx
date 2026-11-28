// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useMemo, useState } from "react"
import { FilterChip } from "@/components/FilterChip"
import { GameIcon } from "@/components/GameIcon"
import { iconTone } from "@/components/RarityChip"
import { Segmented } from "@/components/Segmented"
import type { Account } from "@/domain/account"
import { featuredHistory, itemOf, latestVersion, VERSIONS } from "@/domain/wishes"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { itemView } from "./items"

const t = text.wishes.history
const SORTS = ["gap", "recent", "count"] as const
type Sort = (typeof SORTS)[number]
/** Versions since the last time featured from which the gap shows in amber. */
const LONG_GAP = 12

/** Newest version first; a line before each major version. */
const ORDER = VERSIONS.map((_, i) => i).toReversed()
const major = (index: number) => VERSIONS[index]?.split(".")[0]

type Row = {
  itemId: number
  name: string
  icon?: string
  /** The account's constellation, for a character it has. */
  owned?: number
  count: number
  last: number
  /** Versions since last featured; -1 for one now in the standard wish. */
  gap: number
  halves: Set<string>
}

/**
 * Every featured character and weapon by version, newest on the left: when it
 * was featured, how often, and how many versions ago it last was.
 */
export function HistoryView({ account }: { account: Account | undefined }) {
  const [kind, setKind] = useState<"characters" | "weapons">("characters")
  const [star, setStar] = useState<"5" | "4">("5")
  const [sort, setSort] = useState<Sort>("gap")
  const latest = VERSIONS.length - 1
  const { second } = latestVersion()
  const rows = useMemo(() => {
    const list: Row[] = featuredHistory()
      .filter(item => item.kind === kind && String(item.rank) === star)
      .map(item => {
        const last = Math.max(...item.times.map(time => time.version))
        const key = itemOf(item.itemId)?.key
        const owned =
          kind === "characters"
            ? account?.characters.find(c => c.key === key)?.constellation
            : undefined
        return {
          itemId: item.itemId,
          ...itemView(item.itemId),
          owned,
          count: item.times.length,
          last,
          gap: star === "5" && item.standard ? -1 : latest - last,
          halves: new Set(item.times.map(time => `${time.version}-${time.half}`)),
        }
      })
    const byName = (a: Row, b: Row) => a.name.localeCompare(b.name, "zh")
    const compare: Record<Sort, (a: Row, b: Row) => number> = {
      gap: (a, b) => b.gap - a.gap || byName(a, b),
      recent: (a, b) => b.last - a.last || byName(a, b),
      count: (a, b) => b.count - a.count || b.last - a.last,
    }
    // Ones now in the standard wish go last, whatever the order.
    return list.sort((a, b) => Number(a.gap < 0) - Number(b.gap < 0) || compare[sort](a, b))
  }, [kind, star, sort, account, latest])
  const fill = star === "5" ? "bg-(--gold-fg)" : "bg-(--purple-fg)"
  const sticky = "sticky z-1 bg-overlay"
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          label={t.kindLabel}
          value={kind}
          options={(["characters", "weapons"] as const).map(k => ({ value: k, label: t.kinds[k] }))}
          onPick={setKind}
        />
        <Segmented
          label={t.starLabel}
          value={star}
          options={(["5", "4"] as const).map(s => ({ value: s, label: t.stars[s] }))}
          onPick={setStar}
        />
        <span className="flex-1" />
        <span className="text-[12px] text-muted">{t.sortLabel}</span>
        {SORTS.map(s => (
          <FilterChip
            key={s}
            pressed={sort === s}
            onPress={() => setSort(s)}
            className="h-7 px-3 text-[12px]"
          >
            {t.sorts[s]}
          </FilterChip>
        ))}
      </div>
      <section
        aria-label={t.table}
        className="glass overflow-hidden rounded-[14px] border border-border bg-surface"
      >
        <div className="max-h-[1040px] overflow-auto">
          <table className="border-separate border-spacing-0 text-[13px] tabular">
            <caption className="sr-only">{t.caption(t.stars[star], t.kinds[kind])}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className={cn(
                    sticky,
                    "top-0 left-0 z-3 min-w-[164px] border-(--separator) border-b px-3 py-2.5 text-left font-medium text-[12px] text-muted",
                  )}
                >
                  {t.head(t.kinds[kind], rows.length)}
                </th>
                <th
                  scope="col"
                  className={cn(
                    sticky,
                    "top-0 left-[164px] z-3 min-w-[52px] border-(--separator) border-b px-1.5 py-2.5 text-right font-medium text-[12px] text-muted",
                  )}
                >
                  {t.count}
                </th>
                <th
                  scope="col"
                  className={cn(
                    sticky,
                    "top-0 left-[216px] z-3 min-w-[72px] border-(--separator) border-r border-b py-2.5 pr-3 pl-1.5 text-right font-medium text-[12px] text-muted",
                  )}
                >
                  {t.gap}
                </th>
                {ORDER.map((index, k) => (
                  <th
                    key={index}
                    scope="col"
                    title={
                      index === latest ? t.currentVersion(VERSIONS[index] ?? "") : VERSIONS[index]
                    }
                    className={cn(
                      "sticky top-0 z-2 min-w-[21px] border-(--separator) border-b bg-overlay pt-2.5 pb-1.5 font-normal text-[10px]",
                      index === latest ? "font-bold text-(--accent-text)" : "text-muted",
                      k > 0 &&
                        major(ORDER[k - 1] ?? 0) !== major(index) &&
                        "border-l border-l-border",
                    )}
                  >
                    <span className="mx-auto block rotate-180 leading-none [writing-mode:vertical-rl]">
                      {VERSIONS[index]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.itemId}>
                  <th
                    scope="row"
                    className={cn(
                      sticky,
                      "left-0 border-(--separator) border-b px-3 py-1 text-left font-normal",
                    )}
                  >
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <GameIcon
                        icon={row.icon}
                        label={row.name}
                        className={cn("size-7 rounded-[7px] text-[11px]", iconTone(Number(star)))}
                      />
                      <span>{row.name}</span>
                      {row.owned !== undefined && (
                        <span
                          title={t.owned}
                          className="rounded-[4px] bg-(--accent-soft) px-[5px] text-(--accent-text) text-[10px] leading-[15px]"
                        >
                          C{row.owned}
                        </span>
                      )}
                    </span>
                  </th>
                  <td
                    className={cn(
                      sticky,
                      "left-[164px] border-(--separator) border-b px-1.5 py-1 text-right",
                    )}
                  >
                    {row.count}
                  </td>
                  <td
                    className={cn(
                      sticky,
                      "left-[216px] whitespace-nowrap border-(--separator) border-r border-b py-1 pr-3 pl-1.5 text-right",
                      row.gap < 0
                        ? "text-muted"
                        : row.gap === 0
                          ? "text-(--accent-text)"
                          : row.gap >= LONG_GAP && "text-(--warn)",
                    )}
                  >
                    {row.gap < 0 ? t.standard : row.gap === 0 ? t.current : t.versions(row.gap)}
                  </td>
                  {ORDER.map((index, k) => {
                    const a = row.halves.has(`${index}-0`)
                    const b = row.halves.has(`${index}-1`)
                    const unknown = index === latest && !second
                    return (
                      <td
                        key={index}
                        title={t.cell(VERSIONS[index] ?? "", a, b, unknown)}
                        className={cn(
                          "border-(--separator) border-b px-0.5",
                          index === latest && "bg-(--accent-soft)",
                          k > 0 &&
                            major(ORDER[k - 1] ?? 0) !== major(index) &&
                            "border-l border-l-border",
                        )}
                      >
                        <span aria-hidden className="flex justify-center gap-px">
                          <span
                            className={cn(
                              "h-3.5 w-2 rounded-[2px]",
                              a ? fill : "bg-surface-secondary",
                            )}
                          />
                          <span
                            className={cn(
                              "h-3.5 w-2 rounded-[2px]",
                              b
                                ? fill
                                : unknown
                                  ? "shadow-[inset_0_0_0_1px_var(--border)]"
                                  : "bg-surface-secondary",
                            )}
                          />
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="flex gap-px">
            <span className={cn("h-3.5 w-2 rounded-[2px]", fill)} />
            <span className="h-3.5 w-2 rounded-[2px] bg-(--separator)" />
          </span>
          {t.legend.first}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="flex gap-px">
            <span className="h-3.5 w-2 rounded-[2px] bg-(--separator)" />
            <span className={cn("h-3.5 w-2 rounded-[2px]", fill)} />
          </span>
          {t.legend.second}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-3.5 w-2 rounded-[2px] shadow-[inset_0_0_0_1px_var(--border)]"
          />
          {t.legend.unknown}
        </span>
        {kind === "characters" && (
          <span className="flex items-center gap-1.5">
            <span className="rounded-[4px] bg-(--accent-soft) px-[5px] text-(--accent-text) text-[10px] leading-[15px]">
              C2
            </span>
            {t.legend.owned}
          </span>
        )}
        <span>{t.legend.note}</span>
      </div>
    </div>
  )
}
