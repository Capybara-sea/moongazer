// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"
import { useRoute } from "@/lib/route"
import { AchievementsPage } from "./AchievementsPage"
import { AnecdotesPage } from "./AnecdotesPage"
import { CollectionHome } from "./CollectionHome"
import { PARTS } from "./parts"

/**
 * The overview of the collection, or one part of it at #/collection/<part>.
 * The page stays mounted while others are shown, so it keeps its own part
 * rather than reading the route of whatever page is in front.
 */
export function CollectionPage() {
  const route = useRoute()
  const [part, setPart] = useState(route.page === "collection" ? route.param : undefined)
  if (route.page === "collection" && route.param !== part) setPart(route.param)
  if (part === PARTS.achievements) return <AchievementsPage />
  if (part === PARTS.anecdotes) return <AnecdotesPage />
  return <CollectionHome />
}
