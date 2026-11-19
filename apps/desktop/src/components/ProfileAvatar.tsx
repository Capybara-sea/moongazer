// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"
import { GameIcon } from "@/components/GameIcon"
import { profileFrameIcon, profilePictureIcon } from "@/domain/overviewData"
import { cn } from "@/lib/cn"

const FADE = "transition-colors duration-300 ease-out motion-reduce:transition-none"

/** The account card's, the sync panel's and the side menu's; the last two rings reach into the padding. */
const SIZES = {
  large: {
    plain: "size-20 border-2 border-border bg-surface-secondary text-[30px]",
    box: "size-28",
    picture: "size-[70px] border-2 bg-surface-secondary text-[26px]",
  },
  medium: {
    plain: "size-[42px] border border-border bg-(--overlay) text-[17px]",
    box: "-m-2 size-[58px]",
    picture: "size-9 border bg-(--overlay) text-[14px]",
  },
  small: {
    plain: "size-8 bg-default text-[13px]",
    // Lays out as wide as the plain picture; the ring reaches into the padding.
    box: "-m-1.5 size-11",
    picture: "size-[27px] border bg-default text-[11px]",
  },
}

type Props = {
  /** Profile picture and frame ids from the export. */
  picture: number | undefined
  frame: number | undefined
  /** Whose it is; its first character stands in until the picture loads. */
  label: string
  size: keyof typeof SIZES
}

/**
 * The profile picture, in the player's frame when it has one: the frame is a
 * transparent ring drawn over the picture, which takes about 62% of its width.
 * Until the ring loads, and when no host has it, the picture keeps its border.
 */
export function ProfileAvatar({ picture, frame, label, size }: Props) {
  const ring = frame === undefined ? undefined : profileFrameIcon(frame)
  const [loaded, setLoaded] = useState<string>()
  const icon = picture === undefined ? undefined : profilePictureIcon(picture)
  const sizes = SIZES[size]
  if (ring === undefined) {
    return <GameIcon icon={icon} label={label} className={cn("rounded-full", sizes.plain)} />
  }
  const framed = loaded === ring
  return (
    <span className={cn("relative flex flex-none items-center justify-center", sizes.box)}>
      <GameIcon
        icon={icon}
        label={label}
        className={cn(
          "rounded-full",
          sizes.picture,
          FADE,
          framed ? "border-transparent" : "border-border",
        )}
      />
      <img
        src={`http://icon.localhost/${ring}`}
        alt=""
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(ring)}
        className={cn(
          "pointer-events-none absolute inset-0 size-full object-contain transition-opacity duration-300 ease-out motion-reduce:transition-none",
          !framed && "opacity-0",
        )}
      />
    </span>
  )
}
