// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { CardHeader } from "@/components/CardHeader"
import { Panel } from "@/components/Panel"
import type { Account } from "@/domain/account"
import { text } from "@/i18n"
import { formatNumber } from "@/lib/format"

const count = (n: number | undefined) => (n === undefined ? undefined : formatNumber(n))

/** Collection counts, one small box each in one card; a count the file does not have reads "not read". */
export function CollectionGrid({ account }: { account: Account }) {
  const c = account.collections
  const hangouts = c?.hangouts
  const tiles: [string, string | undefined][] = [
    [text.collections.outfits, count(c?.outfits)],
    [text.collections.gliders, count(c?.gliders)],
    [text.collections.tcgCards, count(c?.tcgCards)],
    [text.collections.recipes, count(c?.recipes)],
    [text.collections.blueprints, count(c?.blueprints)],
    [
      text.collections.hangouts,
      hangouts && `${formatNumber(hangouts.claimed)} / ${formatNumber(hangouts.total)}`,
    ],
    [text.collections.livingBeings, count(c?.livingBeings)],
  ]
  return (
    <Panel aria-label={text.collections.title} className="gap-2.5">
      <CardHeader title={text.collections.title} />
      {/* Full rows only: one row from the window width where every tile fits, else rows of half. */}
      <div className="grid grid-cols-4 gap-2.5 min-[1264px]:grid-cols-7">
        {tiles.map(([label, value]) => (
          <div
            key={label}
            className="glass-inset rounded-[12px] bg-surface-secondary flex flex-col gap-0.5 px-3 py-2.5"
          >
            <span className="text-[12px] text-muted">{label}</span>
            {value === undefined ? (
              <span className="text-[13px] text-muted leading-6">{text.snapshot.notRead}</span>
            ) : (
              <span className="tabular font-semibold text-base">{value}</span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}
