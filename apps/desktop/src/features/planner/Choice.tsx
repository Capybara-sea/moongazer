// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { cn } from "@/lib/cn"

type Props = {
  label: string
  selected: boolean
  disabled?: boolean
  title?: string
  className?: string
  onPick: () => void
}

/** One of the goal editor's picks, filled with the accent when selected. */
export function Choice({ label, selected, disabled, title, className, onPick }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      title={title}
      onClick={onPick}
      className={cn(
        "tabular h-8 cursor-pointer rounded-[8px] border text-[13px] transition-colors duration-150 disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none",
        selected
          ? "border-transparent bg-accent text-accent-foreground"
          : "border-border hover:bg-default/50",
        className,
      )}
    >
      {label}
    </button>
  )
}
