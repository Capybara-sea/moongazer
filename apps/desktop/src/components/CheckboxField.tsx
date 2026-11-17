// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Check } from "lucide-react"
import { cn } from "@/lib/cn"

type Props = {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}

/**
 * A checkbox in a bordered field as tall as the toolbar's selects, as the
 * toolbars' "only unequipped": the field takes the accent when checked. The
 * native input is only visually hidden, so it still reads and works as one.
 */
export function CheckboxField({ checked, label, onChange }: Props) {
  return (
    <label
      className={cn(
        "relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-[9px] border pr-3 pl-2.5 text-[13px] transition-colors duration-150 ease-(--ease-out-soft) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2 motion-reduce:transition-none",
        checked
          ? "border-accent bg-(--accent-soft)"
          : "border-(--field-border) bg-(--field-background)",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.currentTarget.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "flex size-4 flex-none items-center justify-center rounded-[5px] border-[1.5px] transition-colors duration-150 ease-(--ease-out-soft) motion-reduce:transition-none",
          checked ? "border-accent bg-accent text-accent-foreground" : "border-muted",
        )}
      >
        <Check
          size={11}
          strokeWidth={3.5}
          className={cn(
            "transition-opacity duration-150 motion-reduce:transition-none",
            checked ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
      {label}
    </label>
  )
}
