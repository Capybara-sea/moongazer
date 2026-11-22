// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { cn } from "@/lib/cn"

const TONES = {
  accent: "bg-accent",
  gold: "bg-(--gold-fg)",
  muted: "bg-muted",
} as const

type Props = {
  /** 0 to 1; values outside are clamped. */
  value: number
  tone?: keyof typeof TONES
  /** Sets the height, 6 px unless given. */
  className?: string
}

/**
 * A rounded progress bar. The track has the field border's color: the
 * secondary surface is near white on light glass panels and hides it.
 */
export function Bar({ value, tone = "accent", className }: Props) {
  const width = `${Math.min(Math.max(value, 0), 1) * 100}%`
  return (
    <span
      aria-hidden
      className={cn("block h-1.5 overflow-hidden rounded-full bg-(--field-border)", className)}
    >
      <span className={cn("block h-full rounded-full", TONES[tone])} style={{ width }} />
    </span>
  )
}
