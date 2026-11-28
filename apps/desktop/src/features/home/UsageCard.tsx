// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Info } from "lucide-react"
import { Panel } from "@/components/Panel"
import { Tip } from "@/components/Tip"
import { usage } from "@/domain/usage"
import { text } from "@/i18n"
import type { Snapshot } from "@/lib/backend"
import { formatDate, formatDuration } from "@/lib/format"

const h = text.home.usage
const SPANS = ["today", "week", "month", "total"] as const

type Props = { snapshots: readonly Snapshot[]; now: number }

/** Time played today, this week, this month and in all, as auto sync saw the account's logins. */
export function UsageCard({ snapshots, now }: Props) {
  const played = usage(snapshots, now)
  return (
    <Panel aria-label={h.title} className="@container min-w-0 flex-[1_1_380px]">
      <div className="flex items-center gap-1.5">
        <h2 className="font-semibold text-[15px]">{h.title}</h2>
        <Tip content={h.note} className="flex text-muted">
          <Info aria-hidden size={14} />
          <span className="sr-only">{h.note}</span>
        </Tip>
      </div>
      {played.since === undefined ? (
        <p className="text-[12px] text-muted">{h.none}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 @[520px]:grid-cols-4">
            {SPANS.map(span => (
              <div key={span} className="flex min-w-0 flex-col">
                <dt className="text-[12px] text-muted">{h.spans[span]}</dt>
                <dd className="tabular truncate font-semibold text-[17px]">
                  {formatDuration(played[span])}
                </dd>
              </div>
            ))}
          </dl>
          <p className="tabular text-[12px] text-muted">
            {h.logins(played.logins, formatDate(played.since))}
          </p>
        </>
      )}
    </Panel>
  )
}
