// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

// Writes apps/desktop/src/generated/names.json, the Chinese names, rarities, icons, set effects,
// material types, constellations and weapon passives of game items by GOOD key; overview.json, the
// game data the overview page needs; builds.json, constellation talent boosts, artifact main stat
// values and what character stats are computed from; and collection.json, the achievements and
// anecdotes; from the commits pinned in sources.json. `--update` first moves the pins to the
// latest commits.

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { characters, game, manualCharacters, materials, sets, weapons } from "./agdItems.ts"
import { buildProfiles, LANGUAGE, textMap } from "./animeGameData.ts"
import { type Builds, buildBuilds } from "./builds.ts"
import { buildCollection } from "./collection.ts"
import { latestCommit } from "./download.ts"
import { cities, offerings, theaterLevels, travelerNames } from "./manual.ts"
import { crossCheck } from "./optimizer.ts"
import { buildOverview, type Overview } from "./overview.ts"
import { visionNames } from "./snap.ts"
import { buildTables, type Tables } from "./tables.ts"

type Source = { repo: string; branch: string; commit: string }
type Sources = { snapMetadata: Source; genshinOptimizer: Source; animeGameData: Source }

const ROOT = join(import.meta.dirname, "..", "..", "..")
const SOURCES = join(import.meta.dirname, "..", "sources.json")
const OUTPUT = join(ROOT, "apps", "desktop", "src", "generated")
// A much smaller table means an upstream format change, not a smaller game.
const MINIMUM: Record<keyof Tables, number> = {
  characters: 100,
  weapons: 200,
  artifactSets: 50,
  materials: 1000,
  materialTypes: 20,
}
const BUILDS_MINIMUM: Record<keyof Builds, number> = {
  talentBoosts: 100,
  mainStats: 5,
  characterStats: 100,
  characterCurves: 4,
  weaponStats: 200,
  weaponCurves: 10,
  setBonuses: 30,
}
const COLLECTION_MINIMUM: Record<string, number> = {
  achievementGoals: 70,
  achievements: 1800,
}
const OVERVIEW_MINIMUM: Record<keyof Overview, number> = {
  profilePictures: 150,
  nameCards: 250,
  profileFrames: 10,
  theater: 20,
  theaterCasts: 20,
  stygian: 5,
  abyss: 100,
  abyssBlessings: 100,
  areas: 60,
}

const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== "--update")) {
  throw new Error("usage: node src/main.ts [--update]")
}

const sources = JSON.parse(await readFile(SOURCES, "utf8")) as Sources
const pins = [sources.snapMetadata, sources.genshinOptimizer, sources.animeGameData]
for (const source of pins) {
  if (!/^[0-9a-f]{40}$/.test(source.commit)) throw new Error(`bad commit for ${source.repo}`)
}
if (args[0] === "--update") {
  for (const source of pins) {
    source.commit = await latestCommit(source.repo, source.branch)
    console.log(`${source.repo}: ${source.branch} is at ${source.commit}`)
  }
  await writeFile(SOURCES, `${JSON.stringify(sources, null, 2)}\n`)
}

const pin = sources.animeGameData
const [text, english] = await Promise.all([textMap(pin, LANGUAGE), textMap(pin, "EN")])
const profiles = await buildProfiles(pin, text, await visionNames(sources.snapMetadata))
const agd = game(pin, text, english)
const { tables, ids } = buildTables({
  characters: await characters(agd, profiles),
  weapons: await weapons(agd),
  artifactSets: await sets(agd),
  materials: await materials(agd),
})
const optimizer = sources.genshinOptimizer
await crossCheck(optimizer.repo, optimizer.commit, tables)
const collection = await buildCollection(sources.snapMetadata, agd, characterKeys(tables))
for (const [key, entry] of Object.entries(await manualCharacters(agd, profiles, travelerNames))) {
  if (key in tables.characters) throw new Error(`manual character ${key} is also in the game's`)
  tables.characters[key] = entry
}
const overview = await buildOverview(sources.snapMetadata, agd, ids.characters)
const builds = await buildBuilds(agd, ids)
// All are checked before any is written, so a failed run leaves no mismatched set.
const namesCounts = count(tables, MINIMUM)
const overviewCounts = count(overview, OVERVIEW_MINIMUM)
const buildsCounts = count(builds, BUILDS_MINIMUM)
const collectionCounts = count(collection, COLLECTION_MINIMUM)

await mkdir(OUTPUT, { recursive: true })
await write("names.json", namesCounts, {
  sources: {
    snapMetadata: sources.snapMetadata.commit,
    genshinOptimizer: sources.genshinOptimizer.commit,
    animeGameData: sources.animeGameData.commit,
  },
  ...tables,
})
await write("overview.json", overviewCounts, {
  sources: { animeGameData: sources.animeGameData.commit },
  ...overview,
  cities,
  offerings,
  theaterLevels,
})
await write("builds.json", buildsCounts, builds)
await write("collection.json", collectionCounts, {
  sources: {
    snapMetadata: sources.snapMetadata.commit,
    animeGameData: sources.animeGameData.commit,
  },
  ...collection,
})

/** GOOD keys by Chinese name, of the game's characters; a name two share is left out. */
function characterKeys(tables: Tables): Map<string, string> {
  const keys = new Map<string, string>()
  const shared = new Set<string>()
  for (const [key, entry] of Object.entries(tables.characters)) {
    if (keys.has(entry.name)) shared.add(entry.name)
    keys.set(entry.name, key)
  }
  for (const name of shared) keys.delete(name)
  return keys
}

function count(output: object, minimum: Record<string, number>): string {
  return Object.entries(output)
    .map(([kind, table]) => {
      const size = typeof table === "number" ? table : Object.keys(table).length
      const least = minimum[kind] ?? 0
      if (size < least) throw new Error(`only ${size} ${kind}, expected at least ${least}`)
      return `${size} ${kind}`
    })
    .join(", ")
}

async function write(name: string, counts: string, value: object): Promise<void> {
  const file = join(OUTPUT, name)
  const json = `${JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "object" && item !== null && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : 1)))
      : item,
  )}\n`
  await writeFile(file, json)
  console.log(counts)
  console.log(`wrote ${relative(ROOT, file)} (${Buffer.byteLength(json)} bytes)`)
}
