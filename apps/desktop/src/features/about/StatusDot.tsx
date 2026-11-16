// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

export type Tone = "ok" | "warn" | "bad" | "idle"

const COLOR: Record<Tone, string> = {
  ok: "bg-(--ok)",
  warn: "bg-(--warn)",
  bad: "bg-danger",
  idle: "bg-(--off)",
}

/** A small colored dot followed by a short status text. */
export function StatusDot({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px]">
      <span className={cn("size-2 flex-none rounded-full", COLOR[tone])} />
      <span className="truncate">{children}</span>
    </span>
  )
}
