// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Game } from "./agdItems.ts"
import { num, plain, str } from "./tables.ts"

/** `type` is the game's activity type without the NEW_ACTIVITY_ prefix all of them share. */
export type Activity = { name: string; type: string }

/**
 * Every activity's name and type by activity id, the id `gi_events` gives. A few have no name;
 * theirs is empty.
 */
export async function buildActivities(g: Game): Promise<Record<string, Activity>> {
  const rows = await g.table("NewActivityExcelConfigData.json")
  const activities: Record<string, Activity> = {}
  for (const row of rows) {
    const id = num(row, "activityId")
    if (id in activities) throw new Error(`activity ${id} is listed twice`)
    const hash = row.nameTextMapHash
    activities[id] = {
      name: typeof hash === "number" ? plain(g.text(hash)) : "",
      type: str(row, "activityType").replace(/^NEW_ACTIVITY_/, ""),
    }
  }
  return activities
}
