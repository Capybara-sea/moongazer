// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/cn"
import { Tip } from "./Tip"

type Props<T extends string> = {
  /** The group's name read out, such as "display mode". */
  label: string
  value: T
  /** Each option's label is read out and shown on hover. */
  options: readonly { value: T; label: string; icon: LucideIcon }[]
  onChange: (value: T) => void
}

/** Icon buttons in one field, as tall as the toolbar's selects, that pick how a list shows. */
export function ViewToggle<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <fieldset
      aria-label={label}
      className="flex h-9 flex-none gap-0.5 rounded-[9px] border border-(--field-border) bg-(--field-background) p-0.5"
    >
      {options.map(option => {
        const Icon = option.icon
        const pressed = option.value === value
        return (
          <Tip key={option.value} content={option.label} className="contents">
            <button
              type="button"
              aria-pressed={pressed}
              aria-label={option.label}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-[34px] cursor-pointer items-center justify-center rounded-[7px] transition-colors duration-150 ease-(--ease-out-soft) focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 motion-reduce:transition-none",
                pressed ? "bg-(--accent-soft) text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              <Icon aria-hidden size={15} />
            </button>
          </Tip>
        )
      })}
    </fieldset>
  )
}
