// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"
import { useRoute } from "@/lib/route"
import { CharacterDetail } from "./CharacterDetail"
import { CharacterList } from "./CharacterList"

/**
 * The character list, or one character's details at #/characters/<key>. The
 * page stays mounted while others are shown, so it keeps its own character
 * rather than reading the route of whatever page is in front.
 */
export function CharactersPage() {
  const route = useRoute()
  const [key, setKey] = useState(route.page === "characters" ? route.param : undefined)
  if (route.page === "characters" && route.param !== key) setKey(route.param)
  return key === undefined ? <CharacterList /> : <CharacterDetail characterKey={key} />
}
