// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Check } from "lucide-react"
import { cn } from "@/lib/cn"

type Props = {
  /** After a line of text rather than on an icon's corner. */
  inline?: boolean
  /** Read out where the badge is the only sign of being done. */
  label?: string
}

/**
 * The one "done" check: a small green disc with a white tick. On an avatar or
 * icon it sits on the lower right corner, ringed in the surface's color to
 * stand off the picture; the icon's parent has to be `relative`.
 */
export function DoneBadge({ inline = false, label }: Props) {
  const className = cn(
    "size-3.5 flex-none items-center justify-center rounded-full bg-(--ok) text-(--on-accent)",
    inline
      ? "inline-flex align-[-2px]"
      : "absolute -right-0.5 -bottom-0.5 flex shadow-[0_0_0_2px_var(--surface)]",
  )
  const tick = <Check aria-hidden className="size-[9px]" strokeWidth={3.5} />
  if (!label) {
    return (
      <span aria-hidden className={className}>
        {tick}
      </span>
    )
  }
  return (
    <span role="img" aria-label={label} className={className}>
      {tick}
    </span>
  )
}
