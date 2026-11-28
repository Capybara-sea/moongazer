// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { LoaderCircle } from "lucide-react"
import { text } from "@/i18n"
import { useWishStore } from "@/stores/wishStore"

/** The side panel's line while the wish history is read; nothing otherwise. */
export function WishReading() {
  const reading = useWishStore(s => s.progress !== null)
  if (!reading) return null
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted">
      <LoaderCircle aria-hidden size={12} className="animate-spin motion-reduce:animate-none" />
      {text.wishes.autoRead.readingShort}
    </span>
  )
}
