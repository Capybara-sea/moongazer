// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Check, LoaderCircle, X } from "lucide-react"
import { useState } from "react"
import type { Account } from "@/domain/account"
import { type PoolKey, type PoolSummary, poolOf, type Tag, type WishRecord } from "@/domain/wishes"
import type { Snapshot } from "@/lib/backend"
import { revealFile } from "@/lib/backend/wishes"
import { cn } from "@/lib/cn"
import { formatDateTime, maskUid } from "@/lib/format"
import { navigate } from "@/lib/route"
import { useWishStore, type WishNotice } from "@/stores/wishStore"
import { text } from "@/text"
import { FullRecords } from "./FullRecords"
import { LUCK_TONES, poolHidden, TAG_TONES } from "./items"
import { PoolRow } from "./PoolRow"
import { WishCalc } from "./WishCalc"

const t = text.wishes
const TAGS: Tag[] = ["won", "guaranteed", "lost", "radiance"]

type Props = {
  uid: number
  name: string
  records: readonly WishRecord[]
  pools: readonly PoolSummary[]
  snapshot: Snapshot | undefined
  account: Account | undefined
}

/** The records: how auto reading stands, each pool's row, and the calculator. */
export function RecordsView({ uid, name, records, pools, snapshot, account }: Props) {
  const hideEmpty = useWishStore(s => s.hideEmpty)
  const hideNovice = useWishStore(s => s.hideNovice)
  const [full, setFull] = useState<PoolKey | "all" | null>(null)
  const shown = pools.filter(pool => !poolHidden(pool, hideEmpty, hideNovice))
  const hidden = pools.filter(pool => poolHidden(pool, hideEmpty, hideNovice))
  const weapon = pools.find(pool => pool.key === "weapon")
  const path = account?.tasks?.wishPath
  const fate = path
    ? { points: path.points, at: snapshot?.takenAt }
    : { points: weapon?.guaranteed ? 1 : 0 }
  return (
    <>
      <AutoReadLine uid={uid} />
      <NoticeBar uid={uid} />
      <div className="flex flex-col gap-2.5">
        {shown.map(pool => (
          <PoolRow key={pool.key} pool={pool} fate={fate} onOpen={() => setFull(pool.key)} />
        ))}
        {hidden.length > 0 && (
          <button
            type="button"
            onClick={() => useWishStore.getState().setDisplayOpen(true)}
            className="h-[26px] cursor-pointer self-start rounded-[8px] border border-border border-dashed px-2.5 text-[12px] text-muted hover:text-foreground"
          >
            {t.display.hidden(
              hidden.length,
              t.list(
                hidden.map(
                  pool => t.pools[pool.key] + (pool.total === 0 ? t.display.emptyMark : ""),
                ),
              ),
            )}
          </button>
        )}
      </div>
      <Legend />
      <WishCalc pools={pools} account={account} snapshot={snapshot} fate={fate.points} />
      <FullRecords
        pool={full}
        name={name}
        records={records}
        shown={shown.map(pool => pool.key)}
        onPool={setFull}
        onClose={() => setFull(null)}
      />
    </>
  )
}

/** Whether the game's history is read by itself, and when it last was; with a read under way, how it goes. */
function AutoReadLine({ uid }: { uid: number }) {
  const autoRead = useWishStore(s => s.autoRead)
  const readAt = useWishStore(s => s.readAt)
  const progress = useWishStore(s => s.progress)
  if (autoRead === null) return null
  if (progress && progress.uid === uid) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted"
      >
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <LoaderCircle aria-hidden size={14} className="animate-spin motion-reduce:animate-none" />
          {t.autoRead.reading}
        </span>
        {progress.banners.map(({ banner, added, done }, index) => {
          const pool = poolOf(banner)
          const busy = !done && progress.banners.slice(0, index).every(b => b.done)
          return (
            <span key={banner} className={cn("flex items-center gap-1", done && "text-foreground")}>
              {done && <Check aria-hidden size={13} className="text-(--ok)" />}
              {pool ? t.pools[pool] : banner}
              <span className="tabular">
                {done || added > 0 ? t.autoRead.bannerAdded(added) : busy ? t.autoRead.pending : ""}
              </span>
            </span>
          )
        })}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
      {autoRead ? (
        <>
          <span className="flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--ok)_16%,transparent)] px-2 text-(--ok)">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {t.autoRead.on}
          </span>
          <span>
            {[
              t.autoRead.hint,
              ...(readAt === null ? [] : [t.autoRead.last(formatDateTime(readAt))]),
            ].join(" · ")}
          </span>
        </>
      ) : (
        <span>{t.autoRead.off}</span>
      )}
      <button
        type="button"
        onClick={() => navigate("settings")}
        className="cursor-pointer text-(--accent-text) hover:underline"
      >
        {t.autoRead.settings}
      </button>
    </div>
  )
}

function NoticeBar({ uid }: { uid: number }) {
  const notice = useWishStore(s => s.notice)
  if (!notice) return null
  const lines = noticeLines(notice, uid)
  return (
    <div
      role="status"
      className="glass flex items-center gap-2.5 rounded-[10px] border border-border bg-surface py-2 pr-2 pl-3.5 text-[13px]"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {lines.map((line, index) => (
          <span key={line} className={cn(index > 0 && "text-[12px] text-muted")}>
            {line}
          </span>
        ))}
      </span>
      {notice.kind === "export" && (
        <button
          type="button"
          onClick={() => void revealFile(notice.path).catch(() => {})}
          className="h-[30px] flex-none cursor-pointer rounded-[8px] border border-border px-3 text-[12px] hover:bg-default/60"
        >
          {t.notice.reveal}
        </button>
      )}
      <button
        type="button"
        aria-label={t.notice.close}
        onClick={() => useWishStore.getState().setNotice(null)}
        className="flex size-7 flex-none cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-default/60"
      >
        <X aria-hidden size={15} />
      </button>
    </div>
  )
}

function noticeLines(notice: WishNotice, uid: number): string[] {
  switch (notice.kind) {
    case "read": {
      const { end } = notice
      if (end.error) {
        const done = end.added.reduce((sum, [, count]) => sum + count, 0)
        return [
          t.notice.readErrors[end.error],
          ...(done > 0 ? [t.notice.readDone(done, readParts(end.added))] : []),
        ]
      }
      const added = end.added.reduce((sum, [, count]) => sum + count, 0)
      return [t.notice.readDone(added, readParts(end.added))]
    }
    case "import": {
      const lines: string[] = []
      for (const result of notice.results) {
        if (result.uid === uid) lines.unshift(t.notice.imported(result.added, result.known))
        else lines.push(t.notice.importedOther(maskUid(result.uid), result.added))
      }
      const unknown = notice.results.reduce((sum, r) => sum + r.unknownItems, 0)
      const skipped = notice.results.reduce((sum, r) => sum + r.skipped, 0)
      if (unknown > 0) lines.push(t.notice.unknownItems(unknown))
      if (skipped > 0) lines.push(t.notice.skipped(skipped))
      if (notice.results.some(r => r.gap)) lines.push(t.notice.gap)
      return lines
    }
    case "export": {
      const file = notice.path.split(/[\\/]/).at(-1) ?? notice.path
      return [t.notice.exported(notice.count, file)]
    }
    case "error":
      return [notice.message]
  }
}

/** New records by pool, each "<pool> <count>", in a list. */
function readParts(added: [number, number][]) {
  return t.list(
    added
      .filter(([, count]) => count > 0)
      .map(([banner, count]) => {
        const pool = poolOf(banner)
        return t.notice.readPart(pool ? t.pools[pool] : String(banner), count)
      }),
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
      {TAGS.map(tag => (
        <span key={tag} className="flex items-center gap-1.5">
          <span className={cn("rounded-[4px] px-[5px] text-[10px] leading-4", TAG_TONES[tag])}>
            {t.tags[tag]}
          </span>
          {t.tagNotes[tag]}
        </span>
      ))}
      <span aria-hidden className="h-3.5 w-px bg-(--separator)" />
      <span className="flex items-center gap-1.5">
        {t.legendNumber}
        {(["good", "fair", "bad"] as const).map(luck => (
          <span key={luck} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("h-3 w-2.5 rounded-[3px]", LUCK_TONES[luck])} />
            {t.luck[luck]}
          </span>
        ))}
      </span>
    </div>
  )
}
