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

import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { gzipSync } from "node:zlib"
import { download, downloadIfPresent } from "./download.ts"
import { list, record } from "./tables.ts"

const POINTS = "BinOutput/Scene/Point/"
const AREAS = "ExcelBinOutput/WorldAreaConfigData.json"

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

// The crate takes the id for the data set's name and requires 40 hex digits, as a commit id is.
await writeFile(join(out, "manifest.json"), `${JSON.stringify({ id: commit })}\n`)
console.log(
  `${tables.length} tables and ${points.filter(Boolean).length} scene point files of ${repo}@${commit}`,
)
