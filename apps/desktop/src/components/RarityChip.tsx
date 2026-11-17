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
