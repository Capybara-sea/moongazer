// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Delta } from "@/components/Delta"
import { GameIcon } from "@/components/GameIcon"
import { iconTone } from "@/components/RarityChip"
import { cn } from "@/lib/cn"
import { formatNumber, signedDelta } from "@/lib/format"
import type { MaterialRow } from "./order"

/** One material: its icon, name, count and the change since the previous snapshot. */
export function MaterialCard({ row }: { row: MaterialRow }) {
  const { name, icon, rarity, count, change } = row
  return (
    // Cards out of view skip layout and paint, as the artifact cards do.
    <li className="glass flex min-w-0 items-center gap-3 rounded-[12px] border border-border bg-surface px-3 py-2.5 [contain-intrinsic-size:auto_64px] [content-visibility:auto]">
      {/* Hidden: the name next to it says the same. */}
      <span aria-hidden className="contents">
        <GameIcon
          icon={icon}
          label={name}
          className={cn("size-10 rounded-[10px] text-[16px]", iconTone(rarity))}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px]">{name}</span>
        {/* A long count pushes the change to a line of its own. */}
        <span className="tabular flex flex-wrap items-baseline gap-x-2 whitespace-nowrap">
          <span className="font-semibold text-[16px]">{formatNumber(count)}</span>
          {change !== undefined && change !== 0 && (
            <Delta signed={signedDelta(change)} className="text-[12px]" />
          )}
        </span>
      </div>
    </li>
  )
}
