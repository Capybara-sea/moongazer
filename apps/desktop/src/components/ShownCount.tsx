// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { formatNumber } from "@/lib/format"

type Props = {
  shown: number
  total: number
  format: (shown: string, total: string) => string
}

/**
 * "Shown N / total" for a filtered list. It keeps the width the text has with
 * everything shown, so the toolbar around it stays put as the filters change.
 */
export function ShownCount({ shown, total, format }: Props) {
  const all = formatNumber(total)
  return (
    <span className="inline-grid text-[12px] text-muted tabular">
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {format(all, all)}
      </span>
      <span className="col-start-1 row-start-1 text-right">{format(formatNumber(shown), all)}</span>
    </span>
  )
}
