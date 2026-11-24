// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ReactNode } from "react"

type Props = {
  title: string
  /** Beside the title, as the to-do card's tabs. */
  lead?: ReactNode
  /** On the right: a note on the data, or the card's buttons. */
  children?: ReactNode
}

/**
 * A card's one header line, as tall on every card so the titles of cards side
 * by side line up: the title, what goes with it, and on the right a note or
 * buttons. Nothing goes on a line of its own under the title.
 */
export function CardHeader({ title, lead, children }: Props) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2 pb-1.5">
      <h2 className="font-semibold text-[15px]">{title}</h2>
      {lead}
      {children && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
      )}
    </div>
  )
}
