// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

// Writes apps/desktop/src/generated/names.json, the names, rarities, icons, set effects,
// material types, constellations and weapon passives of game items by GOOD key; overview.json, the
// game data the overview page needs; builds.json, constellation talent boosts, artifact main stat
// values and what character stats are computed from; collection.json, the achievements,
// anecdotes, furnishing sets and spincrystals; planner.json, what raising characters and weapons
// costs; and activities.json, the names and types of the game's events; from the commits pinned
// in sources.json. Those with text are written in English too, under en/, with the same entries.
// `--update` first moves the pins to the latest commits.

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { buildActivities } from "./activities.ts"
import {
  characters,
  type Game,
  game,
  inEnglish,
  manualCharacters,
  materials,
  sets,
  weapons,
} from "./agdItems.ts"
import { buildProfiles, textMap } from "./animeGameData.ts"
import { type Builds, buildBuilds } from "./builds.ts"
import { buildCollection } from "./collection.ts"
import { latestCommit } from "./download.ts"
import { buildFurnishings } from "./furnishing.ts"
import { cities, offerings, theaterLevels, travelerNames } from "./manual.ts"
import { crossCheck } from "./optimizer.ts"
import { buildOverview, type Overview } from "./overview.ts"
import { buildPlanner, type Planner } from "./planner.ts"
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
  furnishings: 500,
  spincrystalAreas: 9,
}
const ACTIVITIES_MINIMUM = 300
const PLANNER_MINIMUM: Partial<Record<keyof Planner, number>> = {
  costs: 300,
  characters: 100,
  weapons: 200,
  combine: 100,
  combineMora: 100,
  openDays: 100,
}
const OVERVIEW_MINIMUM: Record<keyof Overview, number> = {
  profilePictures: 150,
  nameCards: 250,
  profileFrames: 10,
  theater: 20,
  theaterCasts: 20,
  stygian: 5,
  stygianBegins: 5,
  abyss: 100,
  abyssBlessings: 100,
  areas: 60,
  realmRates: 10,
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
const snap = sources.snapMetadata
const [chs, english] = await Promise.all([textMap(pin, "CHS"), textMap(pin, "EN")])
const zh = game(pin, chs, english)
/** names.json's tables in `g`'s language, which Snap.Metadata calls `language`, and their ids. */
const items = async (g: Game, language: string) => {
  const profiles = await buildProfiles(g, await visionNames(snap, language))
  const { tables, ids } = buildTables({
    characters: await characters(g, profiles),
    weapons: await weapons(g),
    artifactSets: await sets(g),
    materials: await materials(g),
  })
  return { profiles, tables, ids }
}
const zhItems = await items(zh, "CHS")
const optimizer = sources.genshinOptimizer
await crossCheck(optimizer.repo, optimizer.commit, zhItems.tables)
const keys = characterKeys(zhItems.tables)
const materialKeys = new Set(Object.keys(zhItems.tables.materials))
// Neither has text, so one file serves every language.
const builds = await buildBuilds(zh, zhItems.ids)
const planner = await buildPlanner(zh, zhItems.ids, materialKeys)

/** Each file in `g`'s language by its path under `dir`, with the counts of its tables. */
const localized = async (
  g: Game,
  { profiles, tables, ids }: typeof zhItems,
  dir: string,
): Promise<[string, string, object][]> => {
  const collection = {
    ...(await buildCollection(snap, g, keys)),
    ...(await buildFurnishings(pin, g, ids.characters, materialKeys)),
  }
  for (const [key, entry] of Object.entries(await manualCharacters(g, profiles, travelerNames))) {
    if (key in tables.characters) throw new Error(`manual character ${key} is also in the game's`)
    tables.characters[key] = entry
  }
  const overview = await buildOverview(snap, g, ids.characters)
  const activities = await buildActivities(g)
  const manual = (texts: Record<string, string>) =>
    Object.fromEntries(Object.entries(texts).map(([id, text]) => [id, g.manual(text)]))
  return [
    [
      join(dir, "names.json"),
      count(tables, MINIMUM),
      {
        sources: {
          snapMetadata: sources.snapMetadata.commit,
          genshinOptimizer: sources.genshinOptimizer.commit,
          animeGameData: sources.animeGameData.commit,
        },
        ...tables,
      },
    ],
    [
      join(dir, "overview.json"),
      count(overview, OVERVIEW_MINIMUM),
      {
        sources: { animeGameData: sources.animeGameData.commit },
        ...overview,
        cities: Object.fromEntries(
          Object.entries(cities).map(([id, city]) => [id, { ...city, name: g.manual(city.name) }]),
        ),
        offerings: manual(offerings),
        theaterLevels: manual(theaterLevels),
      },
    ],
    [
      join(dir, "collection.json"),
      count(collection, COLLECTION_MINIMUM),
      {
        sources: {
          snapMetadata: sources.snapMetadata.commit,
          animeGameData: sources.animeGameData.commit,
        },
        ...collection,
      },
    ],
    [
      join(dir, "activities.json"),
      count({ activities }, { activities: ACTIVITIES_MINIMUM }),
      { sources: { animeGameData: sources.animeGameData.commit }, activities },
    ],
  ]
}

const en = inEnglish(zh)
// All are checked before any is written, so a failed run leaves no mismatched set.
const files: [string, string, object][] = [
  ...(await localized(zh, zhItems, OUTPUT)),
  ...(await localized(en, await items(en, "EN"), join(OUTPUT, "en"))),
  [join(OUTPUT, "builds.json"), count(builds, BUILDS_MINIMUM), builds],
  [
    join(OUTPUT, "planner.json"),
    count(planner, PLANNER_MINIMUM),
    { sources: { animeGameData: sources.animeGameData.commit }, ...planner },
  ],
]
for (const [file, counts, value] of files) await write(file, counts, value)

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

async function write(file: string, counts: string, value: object): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const json = `${JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "object" && item !== null && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : 1)))
      : item,
  )}\n`
  await writeFile(file, json)
  console.log(counts)
  console.log(`wrote ${relative(ROOT, file)} (${Buffer.byteLength(json)} bytes)`)
}
