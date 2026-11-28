// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Bar } from "@/components/Bar"
import { CardHeader } from "@/components/CardHeader"
import { Panel } from "@/components/Panel"
import { Tip } from "@/components/Tip"
import type { Account } from "@/domain/account"
import { text } from "@/i18n"
import { formatExploration, regionTiles } from "./regions"

/** Exploration, statue, reputation and offerings per city, one small box each in one card. */
export function RegionGrid({ account }: { account: Account }) {
  const exploration = account.exploration
  const tiles = exploration ? regionTiles(exploration) : []
  return (
    <Panel aria-label={text.regions.title} className="gap-2.5">
      <CardHeader title={text.regions.title}>
        {exploration?.explore && tiles.length > 0 && (
          <span className="text-[12px] text-muted">{text.regions.hint}</span>
        )}
      </CardHeader>
      {/* Full rows only: one row from the window width where every tile fits, else rows of half. */}
      {tiles.length > 0 ? (
        <div className="grid grid-cols-4 gap-2.5 min-[1382px]:grid-cols-8">
          {tiles.map(tile => (
            <div
              key={tile.id}
              data-rise
              className="glass-inset flex flex-col gap-1 rounded-[12px] bg-surface-secondary px-3 py-2.5"
            >
              <div className="flex items-baseline justify-between gap-1.5">
                <span className="whitespace-nowrap font-semibold text-[13px]">{tile.name}</span>
                <span className="tabular font-semibold text-base">
                  {formatExploration(tile.fraction)}
                </span>
              </div>
              <Bar
                value={tile.fraction ?? 0}
                tone={(tile.fraction ?? 0) >= 1 ? "gold" : "accent"}
              />
              <span className="tabular truncate text-[11px] text-muted">{tile.levels}</span>
              <Tip className="tabular truncate text-[11px] text-muted" content={tile.offerings}>
                {tile.offerings}
              </Tip>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-[13px] text-muted">{text.snapshot.notRead}</span>
      )}
    </Panel>
  )
}
