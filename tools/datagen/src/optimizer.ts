// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { download } from "./download.ts"
import type { Tables } from "./snap.ts"

const DIR = "libs/gi/consts/src"
const WEAPON_LISTS = [
  "allWeaponSwordKeys",
  "allWeaponClaymoreKeys",
  "allWeaponPolearmKeys",
  "allWeaponBowKeys",
  "allWeaponCatalystKeys",
]
// Genshin Optimizer's own entries that are not in the game.
const NOT_IN_GAME = new Set(["Somnia", "QuantumCatalyst"])

/** Compares our derived keys with Genshin Optimizer's. Mismatches are only reported. */
export async function crossCheck(repo: string, commit: string, tables: Tables): Promise<void> {
  const keys = async (file: string, names: string[]) => {
    const source = await download(repo, commit, `${DIR}/${file}`)
    const lists = new Map<string, string[]>()
    for (const [, name = "", body = ""] of source.matchAll(
      /export const (\w+)(?::[^=]+)?\s*=\s*\[([\s\S]*?)\]/g,
    )) {
      lists.set(
        name,
        Array.from(body.matchAll(/'([^']*)'/g), ([, key = ""]) => key),
      )
    }
    return names.flatMap(name => {
      const list = lists.get(name)
      if (list === undefined) throw new Error(`${file} has no ${name}`)
      return list
    })
  }
  const [characters, weapons, artifactSets] = await Promise.all([
    keys("character.ts", ["nonTravelerCharacterKeys"]),
    keys("weapon.ts", WEAPON_LISTS),
    keys("artifact.ts", ["allArtifactSetKeys"]),
  ])
  compare("characters", Object.keys(tables.characters), characters)
  compare("weapons", Object.keys(tables.weapons), weapons)
  compare("artifact sets", Object.keys(tables.artifactSets), artifactSets)
}

function compare(kind: string, ours: string[], theirs: string[]) {
  const known = new Set(theirs)
  const have = new Set(ours)
  const extra = ours.filter(key => !known.has(key)).sort()
  const missing = theirs.filter(key => !have.has(key) && !NOT_IN_GAME.has(key)).sort()
  if (extra.length === 0 && missing.length === 0) {
    console.log(`cross-check ${kind}: matches Genshin Optimizer`)
    return
  }
  if (extra.length > 0) {
    console.log(`warning: ${kind} not in Genshin Optimizer (provisional): ${extra.join(", ")}`)
  }
  if (missing.length > 0) {
    console.log(`warning: ${kind} in Genshin Optimizer but not here: ${missing.join(", ")}`)
  }
}
