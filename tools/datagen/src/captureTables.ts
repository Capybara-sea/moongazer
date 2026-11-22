// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

// Writes the game data tables the capture decoder's database is built from, taken from
// AnimeGameData at the commit pinned in sources.json and laid out as upstream's game data crate
// reads them: `<out>/manifest.json` naming the data set, and every file gzipped at
// `<out>/<path>.gz`. `cargo xtask pack` runs this, so a new game version needs no upstream release
// for its tables.
//
// usage: node src/captureTables.ts <upstream's game-data/manifest.json> <out>
// (`<out>` is emptied first.)
//
// Which tables to fetch is read from upstream's own pinned set, so the list follows the upstream
// version that is linked. Its scene point files are not taken from there: which scenes exist
// depends on the game version, so they are worked out from this data set as the crate does.
//
// Beside them it writes, for Moongazer's own decoder (`capture/commissions.rs`) and not read by
// upstream's crate, `<out>/commission-cities.json`, the city of every daily commission by id, and
// `<out>/commission-rewards.json`, Katheryne's reward for the day's commissions by Adventure Rank
// (`[lowest, highest, reward id]`).

import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { gzipSync } from "node:zlib"
import { download, downloadIfPresent } from "./download.ts"
import { list, record } from "./tables.ts"

const POINTS = "BinOutput/Scene/Point/"
const AREAS = "ExcelBinOutput/WorldAreaConfigData.json"
const COMMISSIONS = "ExcelBinOutput/DailyTaskExcelConfigData.json"
/** About half of the 692 commissions 7.2 has: fewer means a field was renamed. */
const MIN_COMMISSIONS = 300
const LEVELS = "ExcelBinOutput/DailyTaskLevelExcelConfigData.json"
/** 7.2 has twelve, one for every five Adventure Ranks. */
const MIN_LEVELS = 10

const [upstreamManifest, out] = process.argv.slice(2)
if (!upstreamManifest || !out || process.argv.length !== 4) {
  throw new Error("usage: node src/captureTables.ts <upstream's game-data/manifest.json> <out>")
}

const sources = JSON.parse(
  await readFile(join(import.meta.dirname, "..", "sources.json"), "utf8"),
) as { animeGameData: { repo: string; commit: string } }
const { repo, commit } = sources.animeGameData
const pinned = record(JSON.parse(await readFile(upstreamManifest, "utf8")), upstreamManifest)
const tables = Object.keys(record(pinned.files, "files")).filter(path => !path.startsWith(POINTS))
if (!tables.includes(AREAS)) throw new Error(`upstream no longer pins ${AREAS}`)

// A data set left over from another commit must not mix with this one.
await rm(out, { recursive: true, force: true })
const write = async (path: string, text: string) => {
  const file = join(out, `${path}.gz`)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, gzipSync(text))
}

await Promise.all(tables.map(async path => write(path, await download(repo, commit, path))))

// A scene an area is in may have no point file; the crate skips those too.
const areas = list(JSON.parse(await download(repo, commit, AREAS)), AREAS)
const scenes = [...new Set(areas.map(row => row.sceneID).filter(id => typeof id === "number"))]
const points = await Promise.all(
  scenes.map(async scene => {
    const path = `${POINTS}scene${scene}_point.json`
    const text = await downloadIfPresent(repo, commit, path)
    if (text !== undefined) await write(path, text)
    return text !== undefined
  }),
)

const cities: Record<number, number> = {}
for (const row of list(JSON.parse(await download(repo, commit, COMMISSIONS)), COMMISSIONS)) {
  if (typeof row.id === "number" && typeof row.cityId === "number") cities[row.id] = row.cityId
}
const commissions = Object.keys(cities).length
if (commissions < MIN_COMMISSIONS)
  throw new Error(`${COMMISSIONS}: only ${commissions} cities read`)
await writeFile(join(out, "commission-cities.json"), `${JSON.stringify(cities)}\n`)

const rewards: [number, number, number][] = []
for (const row of list(JSON.parse(await download(repo, commit, LEVELS)), LEVELS)) {
  const { minPlayerLevel: lowest, maxPlayerLevel: highest, scorePreviewRewardId: reward } = row
  if (typeof lowest === "number" && typeof highest === "number" && typeof reward === "number")
    rewards.push([lowest, highest, reward])
}
if (rewards.length < MIN_LEVELS) throw new Error(`${LEVELS}: only ${rewards.length} rewards read`)
await writeFile(join(out, "commission-rewards.json"), `${JSON.stringify(rewards)}\n`)

// The crate takes the id for the data set's name and requires 40 hex digits, as a commit id is.
await writeFile(join(out, "manifest.json"), `${JSON.stringify({ id: commit })}\n`)
console.log(
  `${tables.length} tables, ${points.filter(Boolean).length} scene point files, ` +
    `${commissions} commission cities and ${rewards.length} commission rewards of ${repo}@${commit}`,
)
