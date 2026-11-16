// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ComponentProps } from "react"
import { cn } from "@/lib/cn"

/** A card as in the design: a glass surface with a thin border and 16 px corners. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "glass flex flex-col gap-3 rounded-[16px] border border-border bg-surface px-5 py-4.5",
        className,
      )}
      {...props}
    />
  )
}
