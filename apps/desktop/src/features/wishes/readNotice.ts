// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { poolOf } from "@/domain/wishes"
import { text } from "@/i18n"
import type { WishReadEnd } from "@/lib/backend/wishes"

const t = text.wishes

/** What a finished read says: the outcome first, then the records it added before an error. */
export function readLines(end: WishReadEnd): string[] {
  const added = end.added.reduce((sum, [, count]) => sum + count, 0)
  if (!end.error) return [t.notice.readDone(added, readParts(end.added))]
  return [
    t.notice.readErrors[end.error],
    ...(added > 0 ? [t.notice.readSaved(added, readParts(end.added))] : []),
  ]
}

/** New records by pool, each "<pool> <count>", in a list. */
function readParts(added: [number, number][]) {
  return t.list(
    added
      .filter(([, count]) => count > 0)
      .map(([banner, count]) => {
        const pool = poolOf(banner)
        return t.notice.readPart(pool ? t.pools[pool] : String(banner), count)
      }),
  )
}
