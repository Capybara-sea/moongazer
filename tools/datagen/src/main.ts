// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

// Writes apps/desktop/src/generated/names.json, the Chinese names, rarities and icons keyed by
// GOOD keys, from the commits pinned in sources.json. `--update` first moves the pins to the
// latest commits.

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { latestCommit } from "./download.ts"
import { manualCharacters } from "./manual.ts"
import { crossCheck } from "./optimizer.ts"
import { buildTables, type Tables } from "./snap.ts"

type Source = { repo: string; branch: string; commit: string }
type Sources = { snapMetadata: Source; genshinOptimizer: Source }

const ROOT = join(import.meta.dirname, "..", "..", "..")
const SOURCES = join(import.meta.dirname, "..", "sources.json")
const OUTPUT = join(ROOT, "apps", "desktop", "src", "generated", "names.json")
// A much smaller table means an upstream format change, not a smaller game.
const MINIMUM: Record<keyof Tables, number> = {
  characters: 100,
  weapons: 200,
  artifactSets: 50,
  materials: 1000,
}

const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== "--update")) {
  throw new Error("usage: node src/main.ts [--update]")
}

const sources = JSON.parse(await readFile(SOURCES, "utf8")) as Sources
for (const source of [sources.snapMetadata, sources.genshinOptimizer]) {
  if (!/^[0-9a-f]{40}$/.test(source.commit)) throw new Error(`bad commit for ${source.repo}`)
}
if (args[0] === "--update") {
  for (const source of [sources.snapMetadata, sources.genshinOptimizer]) {
    source.commit = await latestCommit(source.repo, source.branch)
    console.log(`${source.repo}: ${source.branch} is at ${source.commit}`)
  }
  await writeFile(SOURCES, `${JSON.stringify(sources, null, 2)}\n`)
}

const tables = await buildTables(sources.snapMetadata.repo, sources.snapMetadata.commit)
await crossCheck(sources.genshinOptimizer.repo, sources.genshinOptimizer.commit, tables)
for (const [key, entry] of Object.entries(manualCharacters)) {
  if (key in tables.characters) throw new Error(`manual character ${key} is also in Snap.Metadata`)
  tables.characters[key] = entry
}
for (const kind of ["characters", "weapons", "artifactSets", "materials"] as const) {
  const count = Object.keys(tables[kind]).length
  if (count < MINIMUM[kind]) {
    throw new Error(`only ${count} ${kind}, expected at least ${MINIMUM[kind]}`)
  }
}

const output = {
  sources: {
    snapMetadata: sources.snapMetadata.commit,
    genshinOptimizer: sources.genshinOptimizer.commit,
  },
  ...tables,
}
const json = `${JSON.stringify(output, (_key, value: unknown) =>
  typeof value === "object" && value !== null
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
    : value,
)}\n`
await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, json)

const counts = Object.entries(tables).map(([kind, table]) => `${Object.keys(table).length} ${kind}`)
console.log(`${counts.join(", ")}`)
console.log(`wrote ${relative(ROOT, OUTPUT)} (${Buffer.byteLength(json)} bytes)`)
