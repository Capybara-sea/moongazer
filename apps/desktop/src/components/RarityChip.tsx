// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { cn } from "@/lib/cn"
import { text } from "@/text/zh"

/** Five stars in gold, four in purple, three in blue, lower ones plain. */
export const RARITY_TONES: Record<number, string> = {
  5: "bg-(--gold-bg) text-(--gold-fg)",
  4: "bg-(--purple-bg) text-(--purple-fg)",
  3: "bg-(--accent-soft) text-(--accent-text)",
}

/**
 * An icon's box in the colors the game gives items of its rarity (index.css,
 * per theme), from one star to five; no rarity looks like one star, as the
 * game's specialties do.
 */
const ICON_TONES: Record<number, string> = {
  5: "from-(--rarity-5-from) to-(--rarity-5-to)",
  4: "from-(--rarity-4-from) to-(--rarity-4-to)",
  3: "from-(--rarity-3-from) to-(--rarity-3-to)",
  2: "from-(--rarity-2-from) to-(--rarity-2-to)",
  1: "from-(--rarity-1-from) to-(--rarity-1-to)",
}

export function iconTone(rarity: number | undefined) {
  return cn("bg-linear-to-br text-white/85", ICON_TONES[rarity ?? 1] ?? ICON_TONES[1])
}

/** "5★" as a small colored tag. */
export function RarityChip({ rarity, className }: { rarity: number; className?: string }) {
  return (
    <span
      className={cn(
        "tabular flex-none rounded-[6px] px-1.5 py-px font-semibold text-[11px]",
        RARITY_TONES[rarity] ?? "bg-surface-secondary text-muted",
        className,
      )}
    >
      {text.game.rarity(rarity)}
    </span>
  )
}
