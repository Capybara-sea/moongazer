// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/cn"

const OPEN_DELAY_MS = 400
/** Between the trigger and the bubble, and between the bubble and the window's edges. */
const GAP = 8
const MARGIN = 8

type Props = {
  /** The bubble's content, rendered only while it is open. */
  preview: ReactNode
  /** The bubble's width and the gap between its lines. */
  previewClassName: string
  /** The trigger's layout. */
  className?: string
  children: ReactNode
}

/**
 * A bubble shown after the pointer rests on the children. Not HeroUI's
 * Tooltip: its trigger takes focus, which it must not inside cards that are
 * buttons. Pages draw thousands of these, so a closed one is only a span with
 * two handlers; the bubble mounts when open, in a portal so scrolling lists do
 * not clip it.
 */
export function HoverPreview({ preview, previewClassName, className, children }: Props) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a hover preview; it must not take focus
    <span
      ref={anchor}
      onMouseEnter={() => {
        clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS)
      }}
      onMouseLeave={() => {
        clearTimeout(timer.current)
        setOpen(false)
      }}
      // The pointer passes through the children, so an icon's title does not show over the bubble.
      className={cn("flex flex-none cursor-help *:pointer-events-none", className)}
    >
      {children}
      {open && (
        <Bubble anchor={anchor} className={previewClassName} onClose={setOpen}>
          {preview}
        </Bubble>
      )}
    </span>
  )
}

type BubbleProps = {
  anchor: RefObject<HTMLSpanElement | null>
  className: string
  onClose: (open: false) => void
  children: ReactNode
}

function Bubble({ anchor, className, onClose, children }: BubbleProps) {
  const box = useRef<HTMLDivElement>(null)
  // Below the trigger, or above it when only that fits, or as low as the window lets it when
  // neither does, over the trigger; placed before paint.
  useLayoutEffect(() => {
    const at = anchor.current?.getBoundingClientRect()
    const element = box.current
    if (!at || !element) return
    const below = at.bottom + GAP
    const above = at.top - GAP - element.offsetHeight
    const lowest = Math.max(MARGIN, innerHeight - MARGIN - element.offsetHeight)
    const fitsBelow = below <= lowest
    element.style.top = `${fitsBelow ? below : above >= MARGIN ? above : lowest}px`
    element.style.left = `${Math.max(MARGIN, Math.min(at.left - 4, innerWidth - element.offsetWidth - MARGIN))}px`
  }, [anchor])
  // The bubble stays where it was placed, so it goes when anything scrolls.
  useEffect(() => {
    const close = () => onClose(false)
    addEventListener("scroll", close, { capture: true, passive: true })
    return () => removeEventListener("scroll", close, { capture: true })
  }, [onClose])

  return createPortal(
    <div
      ref={box}
      role="tooltip"
      className={cn(
        "pointer-events-none fixed z-[200] flex flex-col rounded-[12px] border border-border bg-overlay px-3.5 py-3 text-[12px] text-foreground leading-[1.6] shadow-(--pop-shadow) transition-[opacity,translate] duration-150 ease-(--ease-out-soft) starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}
