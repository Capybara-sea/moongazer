// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { cn } from "@/lib/cn"

type Props = {
  checked: boolean
  label: string
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** An on/off switch as in the design: 44 × 24 px, the accent color when on. */
export function Switch({ checked, label, disabled, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-6 w-11 flex-none cursor-pointer items-center rounded-full border p-0.5 disabled:cursor-default disabled:opacity-50",
        checked ? "border-accent bg-accent" : "border-(--field-border) bg-transparent",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-[18px] rounded-full transition-transform duration-150 motion-reduce:transition-none",
          checked ? "translate-x-5 bg-white" : "bg-(--knob-off)",
        )}
      />
    </button>
  )
}
