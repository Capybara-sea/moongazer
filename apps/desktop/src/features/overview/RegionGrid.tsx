// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Bar } from "@/components/Bar"
import { Panel } from "@/components/Panel"
import type { Account } from "@/domain/account"
import { text } from "@/text/zh"
import { formatExploration, regionTiles } from "./regions"

/** Exploration, statue, reputation and offerings per city, one small tile each. */
export function RegionGrid({ account }: { account: Account }) {
  const exploration = account.exploration
  const tiles = exploration ? regionTiles(exploration) : []
  return (
    <section aria-label={text.regions.title} className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="font-semibold text-base">{text.regions.title}</h2>
        {exploration?.explore && tiles.length > 0 && (
          <span className="text-[12px] text-muted">{text.regions.hint}</span>
        )}
      </div>
      {/* Full rows only: one row from the window width where every tile fits, else rows of half. */}
      {tiles.length > 0 ? (
        <div className="grid grid-cols-4 gap-2.5 min-[1382px]:grid-cols-8">
          {tiles.map(tile => (
            <Panel key={tile.id} data-rise className="gap-1 rounded-[12px] px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-1.5">
                <span className="whitespace-nowrap font-semibold text-[13px]">{tile.name}</span>
                <span className="tabular font-semibold text-base">
                  {formatExploration(tile.fraction)}
                </span>
              </div>
              <Bar
                value={tile.fraction ?? 0}
                tone={(tile.fraction ?? 0) >= 1 ? "gold" : "accent"}
                className="h-1"
              />
              <span className="tabular truncate text-[11px] text-muted">{tile.levels}</span>
              <span className="tabular truncate text-[11px] text-muted" title={tile.offerings}>
                {tile.offerings}
              </span>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel className="px-4.5 py-3.5">
          <span className="text-[13px] text-muted">{text.snapshot.notRead}</span>
        </Panel>
      )}
    </section>
  )
}
