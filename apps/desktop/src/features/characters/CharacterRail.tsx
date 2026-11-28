// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect, useRef } from "react"
import { Tip } from "@/components/Tip"
import type { Character } from "@/domain/good"
import { characterData } from "@/domain/names"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { motionAllowed } from "@/lib/motion"
import { navigate } from "@/lib/route"
import { CharacterAvatar } from "./CharacterAvatar"

/**
 * The list shrunk to a column of avatars that switches the character shown.
 * It stays in view while the page scrolls and scrolls on its own.
 */
export function CharacterRail({
  characters,
  selected,
}: {
  characters: Character[]
  selected: string
}) {
  const nav = useRef<HTMLElement>(null)
  const items = useRef(new Map<string, HTMLButtonElement>())
  const scrolled = useRef(false)
  useEffect(() => {
    const box = nav.current
    const item = items.current.get(selected)
    if (!box || !item) return
    // By hand rather than scrollIntoView, which may scroll the page as well:
    // only the column should move.
    const margin = 8
    const top = item.offsetTop - margin
    const bottom = item.offsetTop + item.offsetHeight + margin - box.clientHeight
    const target = Math.min(Math.max(box.scrollTop, bottom), top)
    if (target !== box.scrollTop) {
      box.scrollTo({
        top: target,
        behavior: scrolled.current && motionAllowed() ? "smooth" : "instant",
      })
    }
    scrolled.current = true
  }, [selected])

  // Fits below the title bar, the page's padding and the header row with its gap
  // (33 + 24 + 32 + 16 + 24 px), where the column starts before the page scrolls.
  // Taller, it would end below the window and hide the avatar the effect scrolls to.
  return (
    <nav
      ref={nav}
      aria-label={text.characterDetail.switcher}
      className="glass sticky top-6 flex max-h-[calc(100vh-129px)] w-[74px] flex-none flex-col items-center gap-2 overflow-y-auto overflow-x-hidden rounded-[16px] border border-border bg-surface px-2 py-[9px] [scrollbar-width:none]!"
    >
      {characters.map(character => {
        const name = characterData(character.key).name
        const on = character.key === selected
        return (
          <Tip key={character.key} content={name} className="contents">
            <button
              ref={element => {
                if (element) items.current.set(character.key, element)
                else items.current.delete(character.key)
              }}
              type="button"
              aria-label={name}
              aria-pressed={on}
              onClick={() => navigate("characters", character.key)}
              className={cn(
                "flex flex-none cursor-pointer rounded-[12px] transition-shadow duration-150 motion-reduce:transition-none",
                on
                  ? "shadow-[0_0_0_2px_var(--accent),0_0_0_4px_var(--accent-soft)]"
                  : "hover:shadow-[0_0_0_2px_var(--border)]",
              )}
            >
              <CharacterAvatar characterKey={character.key} size="rail" />
            </button>
          </Tip>
        )
      })}
    </nav>
  )
}
