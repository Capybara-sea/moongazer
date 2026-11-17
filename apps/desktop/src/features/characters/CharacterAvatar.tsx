// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { GameIcon } from "@/components/GameIcon"
import { ELEMENT_ICONS } from "@/domain/elements"
import { characterData } from "@/domain/names"
import { cn } from "@/lib/cn"
import { text } from "@/text/zh"
import { ELEMENT_TINT } from "./elementStyles"

/** Box, corner and element badge sizes: list cards, the detail page's column, its header. */
const SIZES = {
  card: {
    box: "size-[52px] rounded-[12px] text-[18px]",
    badge: "size-[22px]",
    icon: "size-[13px]",
  },
  rail: {
    box: "size-[54px] rounded-[12px] text-[18px]",
    badge: "size-[18px]",
    icon: "size-[11px]",
  },
  hero: { box: "size-24 rounded-[20px] text-[32px]", badge: "size-8", icon: "size-[18px]" },
} as const

type Props = { characterKey: string; size: keyof typeof SIZES; className?: string }

/** A character's icon on its element's tint, with the element in the bottom right corner. */
export function CharacterAvatar({ characterKey, size, className }: Props) {
  const data = characterData(characterKey)
  const sizes = SIZES[size]
  return (
    <span className={cn("relative flex-none", className)}>
      <GameIcon
        icon={data.icon}
        label={data.name}
        className={cn(
          "border",
          sizes.box,
          data.element ? ELEMENT_TINT[data.element] : "border-border bg-surface-secondary",
        )}
      />
      {data.element && (
        <span
          className={cn(
            "absolute -right-1 -bottom-1 flex items-center justify-center rounded-full bg-background",
            sizes.badge,
          )}
        >
          <GameIcon
            icon={ELEMENT_ICONS[data.element]}
            label={text.game.elementLong(text.game.elements[data.element])}
            className={cn("text-[9px]", sizes.icon)}
          />
        </span>
      )}
    </span>
  )
}
