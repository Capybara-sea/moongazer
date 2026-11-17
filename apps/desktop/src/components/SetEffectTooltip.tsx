// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ReactNode } from "react"
import { lookup, setEffects } from "@/domain/names"
import { cn } from "@/lib/cn"
import { text } from "@/text/zh"
import { HoverPreview } from "./HoverPreview"

type Props = {
  setKey: string
  /** Pieces worn: shown in the heading, and effects that need more are muted. */
  equipped?: number
  /** The trigger's layout. */
  className?: string
  children: ReactNode
}

/** A set's effects, shown after the pointer rests on the children. */
export function SetEffectTooltip({ setKey, equipped, className, children }: Props) {
  return (
    <HoverPreview
      preview={<SetEffects setKey={setKey} equipped={equipped} />}
      previewClassName="w-[300px] gap-2"
      className={className}
    >
      {children}
    </HoverPreview>
  )
}

function SetEffects({ setKey, equipped }: { setKey: string; equipped?: number }) {
  return (
    <>
      <span className="flex items-baseline gap-2">
        <span className="font-semibold text-[13px]">{lookup("artifactSets", setKey).name}</span>
        <span className="text-[11px] text-muted">
          {equipped === undefined ? text.setEffects.title : text.setEffects.equipped(equipped)}
        </span>
      </span>
      {setEffects(setKey).map(effect => {
        const active = equipped === undefined || equipped >= effect.need
        return (
          <span
            key={effect.need}
            className={cn("grid grid-cols-[40px_minmax(0,1fr)] gap-2", !active && "text-muted")}
          >
            <span className={cn("font-semibold", active && "text-(--accent-text)")}>
              {text.setEffects.pieces(effect.need)}
            </span>
            {/* One effect has a line break in the game's text. */}
            <span className="whitespace-pre-line">{effect.text}</span>
          </span>
        )
      })}
    </>
  )
}
