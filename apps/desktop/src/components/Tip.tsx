// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import {
  createElement,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/cn"

const OPEN_DELAY_MS = 400
/** Between the trigger and the bubble, and between the bubble and the window's edges. */
const GAP = 8
const MARGIN = 8
/** A plain text tip's bubble. */
const TEXT_BUBBLE = "max-w-[300px] gap-1 whitespace-pre-line px-3 py-2"

/**
 * A bubble shown after the pointer rests on an element, or when it gets
 * keyboard focus, in place of the browser's own title box. Spread `props` on
 * the element and render `bubble` inside it. Not HeroUI's Tooltip: its
 * trigger takes focus, which it must not inside cards that are buttons. Pages
 * draw thousands of these, so a closed one is only handlers; the bubble mounts
 * when open, in a portal so scrolling lists do not clip it.
 *
 * Only the outermost tip under the pointer opens, so a block with a tip shows
 * that one tip all over, even on an icon that has its own.
 */
export function useTip<E extends HTMLElement = HTMLElement>(
  content: ReactNode,
  bubbleClassName = TEXT_BUBBLE,
) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<E>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  if (content === undefined || content === null || content === false || content === "") {
    return { props: {}, bubble: null }
  }
  const show = () => {
    if (anchor.current?.parentElement?.closest("[data-tip]")) return
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setOpen(false)
  }
  const props = {
    ref: anchor,
    "data-tip": "",
    onPointerEnter: (event: React.PointerEvent) => {
      if (event.pointerType !== "touch") show()
    },
    onPointerLeave: hide,
    onPointerDown: hide,
    onFocus: (event: React.FocusEvent) => {
      if (event.target.matches(":focus-visible")) show()
    },
    onBlur: hide,
  }
  const bubble = open ? (
    <Bubble anchor={anchor} className={bubbleClassName} onClose={hide}>
      {content}
    </Bubble>
  ) : null
  return { props, bubble }
}

type TipProps = Omit<HTMLAttributes<HTMLElement>, "content"> & {
  /** What the bubble says; none shows no bubble. Text keeps its line breaks. */
  content: ReactNode
  /**
   * The element the tip is on; a span unless the layout needs another. Give
   * it the `contents` class to wrap a control without a box of its own.
   */
  as?: "span" | "div" | "li" | "p"
  /** The bubble's width and padding, for content other than plain text. */
  bubbleClassName?: string
}

/** An element with a tip: see useTip. */
export function Tip({ content, as = "span", bubbleClassName, children, ...rest }: TipProps) {
  const tip = useTip(content, bubbleClassName)
  return createElement(as, { ...rest, ...tip.props }, children, tip.bubble)
}

type BubbleProps = {
  anchor: RefObject<HTMLElement | null>
  className: string
  onClose: () => void
  children: ReactNode
}

function Bubble({ anchor, className, onClose, children }: BubbleProps) {
  const box = useRef<HTMLDivElement>(null)
  // Below the trigger, or above it when only that fits, or as low as the window lets it when
  // neither does, over the trigger; placed before paint.
  useLayoutEffect(() => {
    // A `contents` wrapper has no box of its own; its first child stands for it.
    const node = anchor.current
    const target =
      node && getComputedStyle(node).display === "contents" ? node.firstElementChild : node
    const at = target?.getBoundingClientRect()
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
    addEventListener("scroll", onClose, { capture: true, passive: true })
    return () => removeEventListener("scroll", onClose, { capture: true })
  }, [onClose])

  return createPortal(
    <div
      ref={box}
      role="tooltip"
      className={cn(
        "pointer-events-none fixed z-[calc(var(--z-index-overlay)+1)] flex flex-col rounded-[12px] border border-border bg-overlay px-3.5 py-3 text-[12px] text-foreground leading-[1.6] shadow-(--pop-shadow) transition-[opacity,translate] duration-150 ease-(--ease-out-soft) starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}
