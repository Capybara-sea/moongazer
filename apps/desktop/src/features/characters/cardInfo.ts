// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Account } from "@/domain/account"
import { type TalentKey, type TalentLevel, talentLevels, wielderKey } from "@/domain/builds"
import type { Artifact, Weapon } from "@/domain/good"
import { type CharacterData, lookup, weaponData } from "@/domain/names"
import { text } from "@/text/zh"

const TALENTS: readonly TalentKey[] = ["auto", "skill", "burst"]

/** A set on a card with its icon (the flower); the rarity is its best equipped piece's. */
export type CardSet = { key: string; name: string; icon?: string; rarity: number; count: number }

/** What a list card or row shows besides the character itself. */
export type CardInfo = {
  /** Normal attack, skill and burst, with the +3 of the constellations reached. */
  talents: ({ key: TalentKey } & TalentLevel)[]
  /** Leyline only. */
  friendship?: number
  weapon?: { key: string; name: string; icon?: string; rarity?: number; refinement: number }
  /** Sets with two or more equipped pieces, most first; undefined when no artifact is equipped. */
  sets?: CardSet[]
}

/** The weapon type: the element already shows as an icon on the avatar. */
export function traits({ weapon }: Pick<CharacterData, "weapon">) {
  return weapon ? text.game.weaponTypes[weapon] : ""
}

/** Each character's card values by key, going through the weapons and artifacts once. */
export function cardInfos({
  characters,
  weapons,
  artifacts,
  characterInfo,
}: Pick<Account, "characters" | "weapons" | "artifacts" | "characterInfo">) {
  const weaponOf = new Map<string, Weapon>()
  for (const weapon of weapons) {
    if (weapon.location && !weaponOf.has(weapon.location)) weaponOf.set(weapon.location, weapon)
  }
  const piecesOf = new Map<string, Artifact[]>()
  for (const artifact of artifacts) {
    if (!artifact.location) continue
    const pieces = piecesOf.get(artifact.location) ?? []
    pieces.push(artifact)
    piecesOf.set(artifact.location, pieces)
  }
  return new Map(
    characters.map((character): [string, CardInfo] => {
      const wielder = wielderKey(character.key)
      const weapon = weaponOf.get(wielder)
      const levels = talentLevels(character)
      return [
        character.key,
        {
          talents: TALENTS.map(key => ({ key, ...levels[key] })),
          friendship: characterInfo.get(character.key)?.friendship,
          weapon: weapon && weaponInfo(weapon),
          sets: equippedSets(piecesOf.get(wielder)),
        },
      ]
    }),
  )
}

function weaponInfo(weapon: Weapon) {
  const { name, icon, rarity } = weaponData(weapon.key)
  return { key: weapon.key, name, icon, rarity, refinement: weapon.refinement }
}

function equippedSets(pieces: Artifact[] | undefined) {
  if (!pieces) return undefined
  const sets = new Map<string, CardSet>()
  for (const { setKey, rarity } of pieces) {
    const set = sets.get(setKey)
    if (set) {
      set.count += 1
      set.rarity = Math.max(set.rarity, rarity)
    } else {
      const { name, icon } = lookup("artifactSets", setKey)
      sets.set(setKey, { key: setKey, name, icon, rarity, count: 1 })
    }
  }
  return [...sets.values()]
    .filter(set => set.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh"))
}
