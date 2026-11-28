// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Panel } from "@/components/Panel"
import { statName } from "@/domain/builds"
import type { Artifact, Character, Weapon } from "@/domain/good"
import { characterData } from "@/domain/names"
import { characterStats } from "@/domain/stats"
import { text } from "@/i18n"
import { statRows } from "./detail"

const t = text.characterDetail

type Props = { character: Character; weapon?: Weapon; artifacts: readonly Artifact[] }

/** The panel stats worked out from game data, in two columns when there is room. */
export function StatsCard({ character, weapon, artifacts }: Props) {
  const stats = characterStats(character, weapon, artifacts)
  const rows = stats && statRows(stats, characterData(character.key).element)
  return (
    <Panel aria-label={t.stats} className="gap-2 px-4.5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h2 className="font-semibold text-[15px]">{t.stats}</h2>
        {rows && <span className="text-[12px] text-muted">{t.statsHint}</span>}
      </div>
      {rows ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-6">
          {rows.map(row => (
            <div
              key={row.key}
              className="flex items-baseline gap-2 border-(--separator) border-b py-1.75 text-[13px]"
            >
              <span className="min-w-0 flex-1 text-muted">{statName(row.key)}</span>
              <span className="tabular font-semibold">{row.total}</span>
              <span className="tabular min-w-23 text-right text-[12px] text-muted">
                {row.base}
                {row.bonus !== undefined && (
                  <span className="ml-1 text-(--accent-text)">{t.statBonus(row.bonus)}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted">{t.noStats}</p>
      )}
    </Panel>
  )
}
