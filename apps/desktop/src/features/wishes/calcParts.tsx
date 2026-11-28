// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { cn } from "@/lib/cn"
import { text } from "@/text"

const t = text.wishes.calc

/** A constellation step in gold, or a refinement step in blue. */
export function StepChip({ kind, count }: { kind: "characters" | "weapons"; count: number }) {
  return (
    <span
      className={cn(
        "min-w-[34px] rounded-[6px] px-[7px] text-center font-semibold text-[12px] leading-[22px]",
        kind === "characters"
          ? "bg-(--gold-bg) text-(--gold-fg)"
          : "bg-(--accent-soft) text-(--accent-text)",
      )}
    >
      {kind === "characters" ? t.cons(count) : t.refine(count)}
    </span>
  )
}

/** A chance as a bar with its percent: green from 80%, amber from 20%, red below. */
export function ChanceBar({ chance }: { chance: number }) {
  const fill =
    chance >= 0.8
      ? "bg-[color-mix(in_srgb,var(--ok)_30%,transparent)]"
      : chance >= 0.2
        ? "bg-[color-mix(in_srgb,var(--warn)_28%,transparent)]"
        : "bg-[color-mix(in_srgb,var(--err)_28%,transparent)]"
  return (
    <span className="relative flex h-[22px] items-center overflow-hidden rounded-[6px] bg-(--separator)">
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0", fill)}
        style={{ width: `${Math.min(100, chance * 100)}%` }}
      />
      <span className="relative px-2 font-semibold">{t.percent(chance)}</span>
    </span>
  )
}
