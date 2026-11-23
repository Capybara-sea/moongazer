// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

export const CACHE = join(import.meta.dirname, "..", ".cache")
const TIMEOUT_MS = 60_000
/** For release archives, tens of MB. */
const LARGE_TIMEOUT_MS = 600_000
const RETRIES = 5
/** The longest Retry-After honoured; beyond it the run fails sooner. */
const MAX_RETRY_AFTER_S = 60
const MAX_REQUESTS = 8

let active = 0
const waiting: (() => void)[] = []

/** A file at a commit. Content at a commit never changes, so the cached copy is reused as is. */
export async function download(repo: string, commit: string, path: string): Promise<string> {
  const text = await downloadIfPresent(repo, commit, path)
  if (text === undefined) throw new Error(`${repo} has no ${path} at ${commit}`)
  return text
}

/** As `download`, for a file the repository may not have: `undefined` when it has none. */
export async function downloadIfPresent(
  repo: string,
  commit: string,
  path: string,
): Promise<string | undefined> {
  const file = join(CACHE, repo.replace("/", "-"), commit, path)
  if (existsSync(file)) return readFile(file, "utf8")
  const text = await fetchText(`https://raw.githubusercontent.com/${repo}/${commit}/${path}`)
  if (text === undefined) return undefined
  await mkdir(dirname(file), { recursive: true })
  // An interrupted run must not leave a partial file that later runs would trust.
  await writeFile(`${file}.part`, text)
  await rename(`${file}.part`, file)
  return text
}

export async function latestCommit(repo: string, branch: string): Promise<string> {
  const url = `https://api.github.com/repos/${repo}/commits/${branch}`
  const sha = (await fetchText(url, { accept: "application/vnd.github.sha" }))?.trim() ?? ""
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`unexpected commit id from ${url}`)
  return sha
}

/** A large file's bytes, or `undefined` for a 404. */
export function fetchBytes(url: string): Promise<Buffer | undefined> {
  return fetchBody(url, undefined, LARGE_TIMEOUT_MS, async response =>
    Buffer.from(await response.arrayBuffer()),
  )
}

function fetchText(url: string, headers?: Record<string, string>): Promise<string | undefined> {
  return fetchBody(url, headers, TIMEOUT_MS, response => response.text())
}

/** The body, or `undefined` for a 404: that is an answer, not an outage, so it is not retried. */
async function fetchBody<T>(
  url: string,
  headers: Record<string, string> | undefined,
  timeout: number,
  read: (response: Response) => Promise<T>,
): Promise<T | undefined> {
  if (active < MAX_REQUESTS) active++
  else await new Promise<void>(resolve => waiting.push(resolve))
  try {
    for (let attempt = 0; ; attempt++) {
      // 2, 4, 8, 16, 32 s: about a minute in all, enough for a brief outage.
      let delay = 2000 * 2 ** attempt
      try {
        const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) })
        if (response.ok) return await read(response)
        if (response.status === 404) return undefined
        // A rate limit or an outage may say when to come back.
        const retryAfter = Number(response.headers.get("retry-after"))
        if (retryAfter > 0) delay = Math.min(retryAfter, MAX_RETRY_AFTER_S) * 1000
        throw new Error(`HTTP ${response.status}`)
      } catch (error) {
        if (attempt === RETRIES) throw new Error(`downloading ${url} failed`, { cause: error })
        await sleep(delay)
      }
    }
  } finally {
    // Pass the slot straight to a waiter; releasing it first would let a new caller slip in.
    const next = waiting.shift()
    if (next) next()
    else active--
  }
}
