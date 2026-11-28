// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { download } from "./download.ts"
import { record } from "./tables.ts"

type Pin = { repo: string; commit: string }

const isName = (name: unknown): name is string => typeof name === "string" && name !== ""

/**
 * What a character's Vision is called in `language`, by avatar id, where Snap.Metadata names it
 * in Chinese. AnimeGameData's text map lacks some of these, such as Aino's Moon Wheel, and its
 * dump cannot tell a missing text from an empty one, so these win.
 */
export async function visionNames(
  { repo, commit }: Pin,
  language: string,
): Promise<Map<number, string>> {
  const load = async (path: string, from = "CHS") =>
    record(JSON.parse(await download(repo, commit, `Genshin/${from}/${path}`)), path)
  const fields = async (id: string, from?: string) => {
    const fetter = record((await load(`Avatar/${id}.json`, from)).FetterInfo, "FetterInfo")
    return [fetter.VisionOverrideLocked, fetter.VisionOverrideUnlocked]
  }
  const ids = Object.keys(await load("Meta.json"))
    .filter(name => name.startsWith("Avatar/"))
    .map(name => name.slice("Avatar/".length))
  const names = await Promise.all(
    ids.map(async (id): Promise<[number, string][]> => {
      const at = (await fields(id)).findIndex(isName)
      if (at === -1) return []
      const vision = (await fields(id, language))[at]
      if (!isName(vision)) throw new Error(`no ${language} Vision name for avatar ${id}`)
      return [[Number(id), vision]]
    }),
  )
  return new Map(names.flat())
}
