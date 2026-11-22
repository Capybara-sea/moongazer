// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ListBox, Select } from "@heroui/react"
import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

type Option = {
  value: string
  label: string
  /**
   * Shown before the label in the list and, when picked, in the trigger. It
   * fills a rounded box of 24 px in the list and 22 px in the trigger, so give
   * it size-full. Options without one keep the space in the list when others
   * have one, so the labels line up.
   */
  icon?: ReactNode
  /** Muted text at the end of the row, such as a count. */
  hint?: string
}

type Props = {
  label: string
  /** Shown in the frame instead of the label, which still names the select. */
  mark?: ReactNode
  value: string
  options: readonly Option[]
  onChange: (value: string) => void
  /** A fixed width, for options of very different lengths: the select would change size with each pick. */
  className?: string
}

/**
 * A select with its muted label inside the same frame, as in "Sort [Level v]".
 * HeroUI's, not the native one, whose list ignores the theme and the glass.
 */
export function LabeledSelect({ label, mark, value, options, onChange, className }: Props) {
  const picked = options.find(option => option.value === value)
  const icons = options.some(option => option.icon)
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={key => {
        if (key !== null) onChange(String(key))
      }}
      className={cn("group", className)}
    >
      <Select.Trigger className="h-9 items-center gap-1.5 rounded-[9px] py-0 pr-2 pl-2.5 text-[13px] shadow-none">
        {mark ?? <span className="text-muted">{label}</span>}
        {picked?.icon && (
          <span className="flex size-[22px] flex-none overflow-hidden rounded-[5px]">
            {picked.icon}
          </span>
        )}
        {/* Only the label: by default the value repeats the whole row, hint included. */}
        <Select.Value className="min-w-0 flex-1 truncate text-left text-[13px] text-foreground">
          {picked?.label}
        </Select.Value>
        <ChevronDown
          aria-hidden
          className="size-3.5 flex-none text-muted transition-transform duration-150 ease-out group-data-open:rotate-180 motion-reduce:transition-none"
        />
      </Select.Trigger>
      <Select.Popover
        placement="bottom end"
        maxHeight={360}
        className="min-w-[max(9rem,var(--trigger-width))] rounded-[12px] border border-border shadow-(--pop-shadow) motion-reduce:animate-none"
      >
        <ListBox>
          {options.map(option => (
            <ListBox.Item
              key={option.value}
              id={option.value}
              textValue={option.label}
              className="gap-2.5 rounded-[6px] text-[13px]"
            >
              {option.icon ? (
                <span className="flex size-6 flex-none overflow-hidden rounded-[6px]">
                  {option.icon}
                </span>
              ) : (
                icons && <span aria-hidden className="size-6 flex-none" />
              )}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.hint && (
                <span className="flex-none text-[12px] text-muted tabular">{option.hint}</span>
              )}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
