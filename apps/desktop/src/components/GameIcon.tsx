// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"
import { cn } from "@/lib/cn"

type Props = {
  /** The game's icon name, e.g. UI_AvatarIcon_Shougun; none shows the placeholder only. */
  icon?: string
  /** What the icon shows; its first character is the placeholder. */
  label: string
  /** Size, shape and colors of the box. */
  className?: string
}

/**
 * A game icon, downloaded and cached by the backend's icon:// protocol. Until
 * it loads, and when no host has it, the box shows the label's first
 * character, as in the design.
 */
export function GameIcon({ icon, label, className }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  const show = icon !== undefined && failed !== icon
  return (
    <span
      title={label}
      className={cn(
        "relative flex flex-none select-none items-center justify-center overflow-hidden font-semibold text-muted",
        className,
      )}
    >
      <span aria-hidden>{initial(label)}</span>
      {show && (
        <img
          src={`http://icon.localhost/${icon}`}
          alt={label}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(icon)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  )
}

/** The first letter or digit, so a name that opens with a bracket does not show the bracket. */
function initial(label: string) {
  const chars = Array.from(label)
  return chars.find(char => /[\p{L}\p{N}]/u.test(char)) ?? chars[0]
}
