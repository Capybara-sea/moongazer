// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { useMemo, useState } from "react"
import { FilterChip } from "@/components/FilterChip"
import { GameIcon } from "@/components/GameIcon"
import { Pager } from "@/components/Pager"
import { iconTone } from "@/components/RarityChip"
import { SearchBox } from "@/components/SearchBox"
import {
  bannerOf,
  compareIds,
  HARD_PITY,
  luckOf,
  type PoolKey,
  type Pull,
  pullsByPool,
  type WishRecord,
} from "@/domain/wishes"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { formatDateTime, formatTimeWithSeconds } from "@/lib/format"
import { itemView, LUCK_BARS, TAG_TONES } from "./items"

const t = text.wishes
const PAGE_SIZE = 50
const RANKS = [5, 4, 3] as const

type Props = {
  /** The pool shown, "all", or null when closed. */
  pool: PoolKey | "all" | null
  name: string
  records: readonly WishRecord[]
  /** The pools the page shows, which the filter offers. */
  shown: readonly PoolKey[]
  onPool: (pool: PoolKey | "all") => void
  onClose: () => void
}

/** Every record, newest first, 50 to a page; three-stars are off until asked for. */
export function FullRecords({ pool, name, records, shown, onPool, onClose }: Props) {
  const [ranks, setRanks] = useState<ReadonlySet<number>>(() => new Set([5, 4]))
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const all = useMemo(() => {
    const pulls = pullsByPool(records)
    return Object.values(pulls)
      .flat()
      .sort((a, b) => b.time - a.time || compareIds(b.id, a.id))
      .map(pull => ({ pull, item: itemView(pull.itemId, pull.name) }))
  }, [records])
  const inPool = all.filter(row => pool === "all" || row.pull.pool === pool)
  const rows = inPool.filter(
    ({ pull, item }) => ranks.has(pull.rank) && (query === "" || item.name.includes(query.trim())),
  )
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const shownPage = Math.min(page, pages - 1)
  const toggle = (rank: number) => {
    const next = new Set(ranks)
    if (next.has(rank)) next.delete(rank)
    else next.add(rank)
    setRanks(next)
    setPage(0)
  }
  return (
    <AlertDialog
      isOpen={pool !== null}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <AlertDialog.Backdrop isDismissable isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="w-[920px] max-w-full">
            <AlertDialog.Header>
              <AlertDialog.Heading className="flex flex-col">
                <span>{t.full.title}</span>
                <span className="font-normal text-[12px] text-muted tabular">
                  {t.full.sub(
                    name,
                    pool === "all" || pool === null ? t.full.allScope : t.pools[pool],
                    inPool.length,
                  )}
                </span>
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(["all", ...shown] as const).map(key => (
                  <FilterChip
                    key={key}
                    pressed={pool === key}
                    onPress={() => {
                      onPool(key)
                      setPage(0)
                    }}
                    className="h-7 px-2.5 text-[12px]"
                  >
                    {key === "all" ? t.full.allPools : t.pools[key]}
                  </FilterChip>
                ))}
                <span aria-hidden className="mx-1 h-[18px] w-px bg-(--separator)" />
                {RANKS.map(rank => (
                  <FilterChip
                    key={rank}
                    pressed={ranks.has(rank)}
                    onPress={() => toggle(rank)}
                    selected={cn(
                      rank === 5 && "border-(--gold-fg) bg-(--gold-bg) text-(--gold-fg)",
                      rank === 4 && "border-(--purple-fg) bg-(--purple-bg) text-(--purple-fg)",
                      rank === 3 &&
                        "border-(--accent-text) bg-(--accent-soft) text-(--accent-text)",
                    )}
                    className="h-7 px-2.5 text-[12px]"
                  >
                    {t.full.star(rank)}
                  </FilterChip>
                ))}
                <div className="ml-auto flex w-[200px] flex-col">
                  <SearchBox
                    value={query}
                    onChange={value => {
                      setQuery(value)
                      setPage(0)
                    }}
                    label={t.full.search}
                  />
                </div>
              </div>
              <div className="max-h-[470px] overflow-y-auto rounded-[12px] border border-(--separator)">
                <table className="w-full border-collapse text-[13px] tabular">
                  <thead>
                    <tr className="text-left text-[12px] text-muted">
                      {(["time", "item", "pity", "banner"] as const).map(column => (
                        <th
                          key={column}
                          scope="col"
                          className={cn(
                            "sticky top-0 z-1 bg-overlay px-3.5 py-2 font-medium",
                            column === "pity" && "w-[240px]",
                          )}
                        >
                          {t.full.columns[column]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE).map(row => (
                      <Row key={row.pull.id} pull={row.pull} item={row.item} />
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <p className="px-3.5 py-6 text-center text-[13px] text-muted">{t.full.none}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-[12px] text-muted">
                <span className="tabular">{t.full.foot(rows.length)}</span>
                <span className="ml-auto">
                  <Pager page={shownPage} pages={pages} onPage={setPage} />
                </span>
              </div>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="secondary">
                {t.full.close}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}

function Row({ pull, item }: { pull: Pull; item: ReturnType<typeof itemView> }) {
  const of = pull.rank === 5 ? HARD_PITY[pull.pool] : 10
  const banner = bannerOf(pull)
  return (
    <tr className="border-(--separator) border-t">
      <td
        title={`${formatDateTime(pull.time).slice(0, 10)} ${formatTimeWithSeconds(pull.time)}`}
        className="whitespace-nowrap px-3.5 py-1.5 text-muted"
      >
        {formatDateTime(pull.time)}
      </td>
      <td className="px-3.5 py-1.5">
        <span className="flex items-center gap-2.5">
          <GameIcon
            icon={item.icon}
            label={item.name}
            className={cn("size-7 rounded-[7px] text-[11px]", iconTone(pull.rank))}
          />
          <span>{item.name}</span>
          {pull.tag && (
            <span
              className={cn("rounded-[4px] px-[5px] text-[10px] leading-4", TAG_TONES[pull.tag])}
            >
              {t.tags[pull.tag]}
            </span>
          )}
        </span>
      </td>
      <td className="px-3.5 py-1.5">
        {pull.rank >= 4 && (
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="h-2 flex-1 overflow-hidden rounded-full bg-surface-secondary"
            >
              <span
                className={cn(
                  "block h-2 rounded-full",
                  pull.rank === 5 ? LUCK_BARS[luckOf(pull.pity, of)] : "bg-(--purple-fg)",
                )}
                style={{ width: `${Math.min(100, (pull.pity / of) * 100)}%` }}
              />
            </span>
            <span className={cn("w-6 text-right", pull.rank === 5 && "font-semibold")}>
              {pull.pity}
            </span>
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3.5 py-1.5">
        {banner ? `${banner.name} · ` : ""}
        <span className="text-muted">{t.pools[pull.pool]}</span>
      </td>
    </tr>
  )
}
