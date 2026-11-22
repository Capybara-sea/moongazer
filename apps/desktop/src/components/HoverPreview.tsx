// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ReactNode } from "react"
import { cn } from "@/lib/cn"
import { useTip } from "./Tip"

type Props = {
  /** The bubble's content, rendered only while it is open. */
  preview: ReactNode
  /** The bubble's width and the gap between its lines. */
  previewClassName: string
  /** The trigger's layout. */
  className?: string
  children: ReactNode
}

/** A tip with a larger bubble, such as a set's effects, on a span around the children. */
export function HoverPreview({ preview, previewClassName, className, children }: Props) {
  const tip = useTip<HTMLSpanElement>(preview, previewClassName)
  return (
    <span {...tip.props} className={cn("flex flex-none cursor-help", className)}>
      {children}
      {tip.bubble}
    </span>
  )
}
