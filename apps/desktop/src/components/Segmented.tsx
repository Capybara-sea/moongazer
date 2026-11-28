// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

type Props<T extends string> = {
  /** The group's name read out. */
  label: string
  value: T
  options: readonly { value: T; label: ReactNode }[]
  /** `from` is the picked button's bounding box. */
  onPick: (value: T, from: DOMRect) => void
  disabled?: boolean
  className?: string
}

/** A few options side by side in one field, the picked one raised. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onPick,
  disabled,
  className,
}: Props<T>) {
  return (
    <fieldset
      aria-label={label}
      disabled={disabled}
      className={cn(
        "flex flex-none gap-0.5 rounded-[9px] bg-surface-secondary p-0.5 disabled:opacity-50",
        className,
      )}
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={e => onPick(option.value, e.currentTarget.getBoundingClientRect())}
          className={cn(
            "h-8 cursor-pointer rounded-[7px] disabled:cursor-default px-3 text-[13px] transition-colors motion-reduce:transition-none",
            option.value === value
              ? "bg-surface font-semibold text-foreground shadow-sm"
              : "text-muted enabled:hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  )
}
