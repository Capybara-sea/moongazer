// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useSyncExternalStore } from "react"

/** The page lives in the URL hash: #/home, #/overview, #/characters/<key>, #/collection/<part>, #/planner. */
export const PAGE_KEYS = [
  "home",
  "overview",
  "characters",
  "weapons",
  "artifacts",
  "materials",
  "collection",
  "planner",
  "settings",
  "about",
] as const
export type PageKey = (typeof PAGE_KEYS)[number]

/** A page and what it shows inside, such as the character a detail page is about. */
export type Route = { page: PageKey; param?: string }

export function isPageKey(value: string): value is PageKey {
  return PAGE_KEYS.some(key => key === value)
}

export function parseRoute(hash: string): Route {
  const [page = "", param] = hash.replace(/^#\/?/, "").split("/")
  if (!isPageKey(page)) return { page: "home" }
  if (!param) return { page }
  try {
    return { page, param: decodeURIComponent(param) }
  } catch {
    // A malformed escape: show the page itself.
    return { page }
  }
}

let current = parseRoute(location.hash)
const listeners = new Set<() => void>()

addEventListener("hashchange", () => {
  const next = parseRoute(location.hash)
  if (next.page !== current.page || next.param !== current.param) {
    current = next
    for (const listener of listeners) listener()
  }
})

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function useRoute() {
  return useSyncExternalStore(subscribe, () => current)
}

export function usePage() {
  return useRoute().page
}

/** Shows another page, through the hashchange above. */
export function navigate(page: PageKey, param?: string) {
  location.hash = param === undefined ? `#/${page}` : `#/${page}/${encodeURIComponent(param)}`
}
