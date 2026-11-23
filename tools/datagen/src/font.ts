// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

// Writes the UI font, Sarasa UI SC (SIL OFL 1.1), from Sarasa Gothic's own release: its regular and
// semibold faces, unmodified, into apps/desktop/src/generated/fonts. The archive is checked against
// its pinned hash and kept in the cache, so later runs, and builds once the release is gone, need
// no download. Run on its own by `cargo xtask gen-data` and `dist`, apart from main.ts, so that what
// only refreshes the game data never fetches the font.

import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { CACHE, fetchBytes } from "./download.ts"

const OUTPUT = join(import.meta.dirname, "..", "..", "..", "apps", "desktop", "src", "generated")
const REPO = "be5invis/Sarasa-Gothic"
// A new release also changes SARASA_VERSION in xtask/src/notices.rs, the license in
// xtask/licenses/Sarasa-Gothic.txt and the version in THIRD_PARTY_NOTICES.md.
const RELEASE = "v1.0.43"
const ARCHIVE = "SarasaUiSC-TTF-1.0.43.7z"
const ARCHIVE_SHA256 = "3dc0f534b2cfa5f98b58a574948d3e3f9eb140600bd738f259c3d077acb2de66"
/** The faces the app uses, with their hashes. */
const FACES: Record<string, string> = {
  "SarasaUiSC-Regular.ttf": "a50953ae631ba84ca5902b1c46463ce83068a37ea721131c025136e59174b68f",
  "SarasaUiSC-SemiBold.ttf": "608443658d77bc8eb41fdb42db1cbdfadc46392a32aa6b75c575a7c8135dbc5c",
}
/** 7-Zip by the names it goes by on Windows and Linux, then where its Windows installer puts it. */
const SEVEN_ZIP = [
  "7z",
  "7zz",
  "7za",
  join(process.env.ProgramFiles ?? "C:\\Program Files", "7-Zip", "7z.exe"),
]

await writeFont(OUTPUT)

/** Writes the faces into `output`/fonts unless they are there already. */
async function writeFont(output: string): Promise<void> {
  const dir = join(output, "fonts")
  if ((await faceProblems(dir)).length === 0) return
  const archive = await cachedArchive()
  await mkdir(dir, { recursive: true })
  extract(archive, dir)
  const problems = await faceProblems(dir)
  if (problems.length > 0) throw new Error(`${ARCHIVE} gave: ${problems.join("; ")}`)
  console.log(`wrote ${Object.keys(FACES).length} font faces from ${ARCHIVE}`)
}

/** What is missing from `dir` or does not match its hash; nothing when every face is right. */
async function faceProblems(dir: string): Promise<string[]> {
  const problems = []
  for (const [name, hash] of Object.entries(FACES)) {
    const file = join(dir, name)
    if (!existsSync(file)) problems.push(`no ${name}`)
    else {
      const bytes = await readFile(file)
      if (sha256(bytes) !== hash) problems.push(`${name} ${described(bytes)}, not the pinned one`)
    }
  }
  return problems
}

/** The archive in the cache, downloaded first when it is not there. */
async function cachedArchive(): Promise<string> {
  const file = join(CACHE, REPO.replace("/", "-"), RELEASE, ARCHIVE)
  if (existsSync(file)) {
    const bytes = await readFile(file)
    if (sha256(bytes) !== ARCHIVE_SHA256) {
      throw new Error(
        `${file} is ${described(bytes)}, not the pinned one; delete it to download it again`,
      )
    }
    return file
  }
  const url = `https://github.com/${REPO}/releases/download/${RELEASE}/${ARCHIVE}`
  const bytes = await fetchBytes(url)
  if (bytes === undefined) {
    throw new Error(
      `${url} is gone; put a copy of ${ARCHIVE} (SHA-256 ${ARCHIVE_SHA256}) at ${file}`,
    )
  }
  if (sha256(bytes) !== ARCHIVE_SHA256) {
    throw new Error(`${url} gave ${described(bytes)}, not the pinned ${ARCHIVE_SHA256}`)
  }
  await mkdir(dirname(file), { recursive: true })
  // An interrupted run must not leave a partial file that later runs would trust.
  await writeFile(`${file}.part`, bytes)
  await rename(`${file}.part`, file)
  return file
}

function extract(archive: string, dir: string): void {
  for (const tool of SEVEN_ZIP) {
    const run = spawnSync(tool, ["e", "-y", `-o${dir}`, archive, ...Object.keys(FACES)], {
      encoding: "utf8",
    })
    if ((run.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") continue
    if (run.error) throw new Error(`running ${tool} failed`, { cause: run.error })
    if (run.status !== 0) {
      throw new Error(`7-Zip failed on ${archive}:\n${run.stderr || run.stdout}`)
    }
    return
  }
  throw new Error("7-Zip is needed to unpack the UI font: install it from https://www.7-zip.org")
}

function described(bytes: Buffer): string {
  return `${bytes.length} bytes with SHA-256 ${sha256(bytes)}`
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}
