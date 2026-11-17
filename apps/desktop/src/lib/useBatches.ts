// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect, useRef, useState } from "react"

const BATCH = 60

/**
 * The first 60 items of a list and 60 more each time the sentinel, drawn
 * after them while more are left, comes within 800 px of the bottom of the
 * page's scroll area; back to 60 when the list changes. A long list of glass
 * cards at once is too much to draw.
 */
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
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setBatch({ items, count: count + BATCH })
        }
      },
      // The page's section scrolls, not the window: with the viewport as the
      // root, the margin below would be clipped by the section.
      { root: node.closest("section[data-page]"), rootMargin: "0px 0px 800px 0px" },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [items, count])
  return { visible: items.slice(0, count), more: count < items.length, sentinel }
}
