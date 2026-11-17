// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Search } from "lucide-react"
import { cn } from "@/lib/cn"

type Props = {
  value: string
  /** The placeholder, and the hidden label read out for the field. */
  label: string
  onChange: (value: string) => void
  /** The input's width. */
  className?: string
}

export function SearchBox({ value, label, onChange, className }: Props) {
  return (
    <label
      className={cn(
        "flex h-9 items-center rounded-[9px] border border-(--field-border) bg-(--field-background) text-[13px] text-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2",
        "gap-2 px-2.5",
      )}
    >
      <Search aria-hidden size={15} className="flex-none" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={label}
        onChange={e => onChange(e.currentTarget.value)}
        className={cn(
          "w-[150px] bg-transparent text-foreground outline-none placeholder:text-muted",
          className,
        )}
      />
    </label>
  )
}
