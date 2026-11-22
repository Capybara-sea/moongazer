// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"
import { cn } from "@/lib/cn"
import { useTip } from "./Tip"

type Props = {
  /** The game's icon name, e.g. UI_AvatarIcon_Shougun; none shows the placeholder only. */
  icon?: string
  /** What the icon shows; its first character is the placeholder. */
  label: string
  /** Shown in place of the label's first character, as "?" for what is not known yet. */
  placeholder?: string
  /** Size, shape and colors of the box. */
  className?: string
}

/**
 * A game icon, downloaded and cached by the backend's icon:// protocol. Until
 * it loads, and when no host has it, the box shows the label's first
 * character, as in the design. Its tip names it, unless it sits in a block
 * with a tip of its own.
 */
export function GameIcon({ icon, label, placeholder, className }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const tip = useTip<HTMLSpanElement>(label)
  const show = icon !== undefined && failed !== icon
  return (
    <span
      {...tip.props}
      className={cn(
        "relative flex flex-none select-none items-center justify-center overflow-hidden font-semibold text-muted",
        className,
      )}
    >
      {/* Hidden once loaded: icons with transparent parts would let it show through. */}
      {!(show && loaded === icon) && <span aria-hidden>{placeholder ?? initial(label)}</span>}
      {/* With no image, this names the icon as the image's alt would. */}
      {!show && <span className="sr-only">{label}</span>}
      {show && (
        <img
          src={`http://icon.localhost/${icon}`}
          alt={label}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(icon)}
          onError={() => setFailed(icon)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {tip.bubble}
    </span>
  )
}

/** The first letter or digit, so a name that opens with a bracket does not show the bracket. */
function initial(label: string) {
  const chars = Array.from(label)
  return chars.find(char => /[\p{L}\p{N}]/u.test(char)) ?? chars[0]
}
