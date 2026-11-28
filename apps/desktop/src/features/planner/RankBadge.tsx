// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { text } from "@/text"

/**
 * A talent's place in the order of importance, from 0, as a small numbered
 * tag; screen readers get it in words.
 */
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="inline-flex size-4 flex-none items-center justify-center rounded-[5px] bg-(--accent-soft) font-semibold text-(--accent-text) text-[10px] tabular leading-none">
      <span aria-hidden>{rank + 1}</span>
      <span className="sr-only">{text.planner.rankLabel(rank + 1)}</span>
    </span>
  )
}
