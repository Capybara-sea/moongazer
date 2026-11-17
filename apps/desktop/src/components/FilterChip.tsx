// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

type Props = {
  pressed: boolean
  onPress: () => void
  /** Background, border and text when pressed; the accent unless given. */
  selected?: string
  /** The name read out and shown on hover, for a chip that holds only an icon. */
  label?: string
  className?: string
  children: ReactNode
}

/** A rounded toggle in a row of filters, as in the design. */
export function FilterChip({ pressed, onPress, selected, label, className, children }: Props) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onPress}
      className={cn(
        "flex h-[34px] cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] transition-colors duration-150 ease-(--ease-out-soft) motion-reduce:transition-none",
        pressed
          ? cn("font-semibold", selected ?? "border-accent bg-accent text-accent-foreground")
          : "hover:border-(--field-border)",
        className,
      )}
    >
      {children}
    </button>
  )
}
