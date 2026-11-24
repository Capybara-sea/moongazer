// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect, useRef, useState } from "react"

const BATCH = 60

/**
 * The first 60 items of a list and 60 more each time the sentinel, drawn
 * after them while more are left, comes within 800 px of the bottom of the
 * area that scrolls; back to 60 when the list changes. A long list of cards
 * at once is too much to draw.
 */
/** The nearest ancestor that scrolls up and down, else the page's section. */
function scrollArea(node: HTMLElement) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY === "auto" || overflowY === "scroll") return el
  }
  return node.closest("section[data-page]")
}

export function useBatches<T>(items: readonly T[]) {
  const [batch, setBatch] = useState({ items, count: BATCH })
  // Reset while rendering, not in an effect, so a new list never shows with the old count.
  if (batch.items !== items) setBatch({ items, count: BATCH })
  const count = batch.items === items ? batch.count : BATCH
  const sentinel = useRef<HTMLDivElement>(null)
  // Rebuilt after every batch: a new observer reports at once if the sentinel is still in range.
  useEffect(() => {
    const node = sentinel.current
    if (!node || count >= items.length) {
      return
    }
    let observer: IntersectionObserver | undefined
    // Watched again when the window is resized: a page may scroll as a whole when narrow and by
    // columns when wide.
    const watch = () => {
      observer?.disconnect()
      observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            setBatch({ items, count: count + BATCH })
          }
        },
        // The page's section or a column of it scrolls, not the window: with the
        // viewport as the root, the margin below would be clipped by it.
        { root: scrollArea(node), rootMargin: "0px 0px 800px 0px" },
      )
      observer.observe(node)
    }
    watch()
    window.addEventListener("resize", watch)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", watch)
    }
  }, [items, count])
  return { visible: items.slice(0, count), more: count < items.length, sentinel }
}
