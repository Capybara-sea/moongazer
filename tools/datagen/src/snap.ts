// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { download } from "./download.ts"
import { record } from "./tables.ts"

type Pin = { repo: string; commit: string }

/**
 * What a character's Vision is called, by avatar id, where Snap.Metadata names it. AnimeGameData's
 * text map lacks some of these, such as Aino's Moon Wheel, and its dump cannot tell a missing text
 * from an empty one, so these win.
 */
export async function visionNames({ repo, commit }: Pin): Promise<Map<number, string>> {
  const load = async (path: string) =>
    record(JSON.parse(await download(repo, commit, `Genshin/CHS/${path}`)), path)
  const ids = Object.keys(await load("Meta.json"))
    .filter(name => name.startsWith("Avatar/"))
    .map(name => name.slice("Avatar/".length))
  const names = await Promise.all(
    ids.map(async (id): Promise<[number, string][]> => {
      const fetter = record((await load(`Avatar/${id}.json`)).FetterInfo, "FetterInfo")
      const vision = [fetter.VisionOverrideLocked, fetter.VisionOverrideUnlocked].find(
        (name): name is string => typeof name === "string" && name !== "",
      )
      return vision ? [[Number(id), vision]] : []
    }),
  )
  return new Map(names.flat())
}
