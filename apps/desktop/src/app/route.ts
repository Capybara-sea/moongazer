// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { PageKey } from "@/lib/route"
import { text } from "@/text/zh"

/**
 * The side menu, in order. `group` starts a labelled group; `divider` puts a
 * line above the item.
 */
export const PAGES: { key: PageKey; label: string; group?: string; divider?: true }[] = [
  { key: "home", label: text.nav.home },
  { key: "overview", label: text.nav.overview, group: text.nav.accountGroup },
  { key: "characters", label: text.nav.characters, group: text.nav.accountGroup },
  { key: "weapons", label: text.nav.weapons, group: text.nav.accountGroup },
  { key: "artifacts", label: text.nav.artifacts, group: text.nav.accountGroup },
  { key: "materials", label: text.nav.materials, group: text.nav.accountGroup },
  { key: "collection", label: text.nav.collection, group: text.nav.accountGroup },
  { key: "planner", label: text.nav.planner, group: text.nav.growGroup },
  { key: "settings", label: text.nav.settings, divider: true },
  { key: "about", label: text.nav.about },
]
