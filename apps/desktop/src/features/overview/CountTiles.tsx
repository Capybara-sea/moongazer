// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronRight } from "lucide-react"
import type { Snapshot } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { navigate } from "@/lib/route"
import { text } from "@/text/zh"
import { countTiles, type Tile } from "./tileValues"

/**
 * The snapshot's totals with their change since the snapshot before (`older`
 * is every older one, newest first).
 */
type Props = { snapshot: Snapshot; older: Snapshot[]; standIn?: Snapshot }

export function CountTiles({ snapshot, older, standIn }: Props) {
  return (
    // Full rows only: one row from the window width where every tile fits, else rows of half.
    <section
      aria-label={text.tiles.label}
      className="grid grid-cols-3 gap-3 min-[1184px]:grid-cols-6"
    >
      {countTiles(snapshot, older, standIn).map(tile => {
        const { page } = tile
        const look =
          "glass flex min-w-0 flex-col gap-0.5 rounded-[14px] border border-border bg-surface px-4 py-3.5 text-left"
        return page ? (
          <button
            key={tile.label}
            type="button"
            onClick={() => navigate(page)}
            className={cn(look, "cursor-pointer transition-colors hover:border-(--field-border)")}
          >
            <TileContent tile={tile} />
          </button>
        ) : (
          <div key={tile.label} className={look}>
            <TileContent tile={tile} />
          </div>
        )
      })}
    </section>
  )
}

function TileContent({ tile }: { tile: Tile }) {
  return (
    <>
      <span className="flex items-center justify-between gap-1 text-[13px] text-muted">
        <span className="truncate">{tile.label}</span>
        {tile.page && <ChevronRight aria-hidden size={14} className="flex-none" />}
      </span>
      {/* Keyed by what they show, so a changed value fades in when another snapshot is picked. */}
      <span
        key={tile.value}
        data-rise
        title={tile.hint}
        className={cn(
          "font-semibold text-[24px] leading-[1.3] tabular",
          tile.hint && "font-normal text-[15px] text-muted leading-[31px]",
        )}
      >
        {tile.value}
      </span>
      {tile.change && (
        <span
          key={tile.change.text}
          data-rise
          className={cn(
            "text-[12px] tabular",
            tile.change.up ? "text-(--accent-text)" : "text-muted",
          )}
        >
          {tile.change.text}
        </span>
      )}
    </>
  )
}
