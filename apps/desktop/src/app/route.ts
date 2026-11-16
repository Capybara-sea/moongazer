// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useSyncExternalStore } from "react"
import { text } from "@/text/zh"

/** The page lives in the URL hash: #/home, #/overview. */
export type PageKey = "home" | "overview" | "settings" | "about"

/**
 * The side menu, in order. `group` starts a labelled group; `divider` puts a
 * line above the item.
 */
export const PAGES: { key: PageKey; label: string; group?: string; divider?: true }[] = [
  { key: "home", label: text.nav.home },
  { key: "overview", label: text.nav.overview, group: text.nav.accountGroup },
  { key: "settings", label: text.nav.settings, divider: true },
  { key: "about", label: text.nav.about },
]

function isPageKey(value: string): value is PageKey {
  return PAGES.some(p => p.key === value)
}

export function parsePage(hash: string): PageKey {
  const page = hash.replace(/^#\/?/, "").split("/")[0] ?? ""
  return isPageKey(page) ? page : "home"
}

let current = parsePage(location.hash)
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

addEventListener("hashchange", () => {
  const page = parsePage(location.hash)
  if (page !== current) {
    current = page
    emit()
  }
})

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function usePage() {
  return useSyncExternalStore(subscribe, () => current)
}

/** Shows another page, through the hashchange above. */
export function navigate(page: PageKey) {
  location.hash = `#/${page}`
}
