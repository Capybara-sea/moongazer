// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"

/** A page number (0-based), or a gap between the numbers shown. */
export type PageItem = number | "gap"

/**
 * The page numbers a pager shows for `pages` pages at `current`: the first,
 * the last and the ones next to the current, with a gap for each run left
 * out. A gap that would stand for one page shows that page instead.
 */
export function pageItems(current: number, pages: number): PageItem[] {
  const shown = new Set([0, pages - 1, current - 1, current, current + 1])
  const items: PageItem[] = []
  for (let page = 0; page < pages; page++) {
    const near = shown.has(page)
    const lone = !near && shown.has(page - 1) && shown.has(page + 1)
    if (near || lone) items.push(page)
    else if (items.at(-1) !== "gap") items.push("gap")
  }
  return items
}

/** `size` items a page; back to the first page when the list changes. */
export function usePages<T>(items: readonly T[], size: number) {
  const [state, setState] = useState({ items, page: 0 })
  // Reset while rendering, not in an effect, so a new list never shows an old page.
  if (state.items !== items) setState({ items, page: 0 })
  const pages = Math.max(1, Math.ceil(items.length / size))
  const page = state.items === items ? Math.min(state.page, pages - 1) : 0
  return {
    page,
    pages,
    visible: items.slice(page * size, (page + 1) * size),
    setPage: (next: number) => setState({ items, page: Math.max(0, Math.min(next, pages - 1)) }),
  }
}
