// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Element } from "@/domain/elements"
import type { Character } from "@/domain/good"
import { characterData } from "@/domain/names"
import type { CharacterSort } from "@/stores/characterListStore"
import { lang } from "@/text"

type Options = { element: Element | null; query: string; sort: CharacterSort }

/**
 * The characters the list shows, in its order: filtered by element and by a
 * name containing the query, sorted by the chosen value, then by rarity or
 * level, then by name, all highest first.
 */
export function visibleCharacters(characters: readonly Character[], options: Options) {
  const query = options.query.trim().toLowerCase()
  const rows = characters
    .map(character => ({ character, data: characterData(character.key) }))
    .filter(({ data }) => options.element === null || data.element === options.element)
    .filter(({ data }) => query === "" || data.name.toLowerCase().includes(query))
  const rarity = (row: (typeof rows)[number]) => row.data.rarity ?? 0
  const by: Record<CharacterSort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> =
    {
      level: (a, b) => b.character.level - a.character.level || rarity(b) - rarity(a),
      rarity: (a, b) => rarity(b) - rarity(a) || b.character.level - a.character.level,
      constellation: (a, b) =>
        b.character.constellation - a.character.constellation || rarity(b) - rarity(a),
    }
  return rows
    .sort((a, b) => by[options.sort](a, b) || a.data.name.localeCompare(b.data.name, lang))
    .map(row => row.character)
}
