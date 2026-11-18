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

/** An outline rather than a shadow, so the ring changes color with the dot. */
const HALO: Record<Tone, string> = {
  ok: "outline-3 outline-[color:color-mix(in_srgb,var(--ok)_25%,transparent)]",
  warn: "outline-3 outline-[color:color-mix(in_srgb,var(--warn)_25%,transparent)]",
  bad: "outline-3 outline-[color:color-mix(in_srgb,var(--danger)_25%,transparent)]",
  idle: "outline-3 outline-[color:color-mix(in_srgb,var(--off)_25%,transparent)]",
}

/** The tone at a quarter strength, behind a status pill. */
export const TONE_SOFT: Record<Tone, string> = {
  ok: "bg-[color-mix(in_srgb,var(--ok)_25%,transparent)]",
  warn: "bg-[color-mix(in_srgb,var(--warn)_25%,transparent)]",
  bad: "bg-[color-mix(in_srgb,var(--danger)_25%,transparent)]",
  idle: "bg-[color-mix(in_srgb,var(--off)_25%,transparent)]",
}

type Props = {
  tone: Tone
  /** A faint ring around the dot, as on the side menu's sync card. */
  halo?: boolean
  className?: string
  children: ReactNode
}

/** A small colored dot followed by a short status text. */
export function StatusDot({ tone, halo = false, className, children }: Props) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2 text-[13px]", className)}>
      <span
        className={cn(
          "size-2 flex-none rounded-full transition-colors duration-200 motion-reduce:transition-none",
          COLOR[tone],
          halo && HALO[tone],
        )}
      />
      <span className="truncate">{children}</span>
    </span>
  )
}
