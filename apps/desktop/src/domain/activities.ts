// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The game's events by the activity id `gi_events` gives, from the table
 * `cargo xtask gen-data` builds, and the group the to-do card files each under.
 */

import { activities as data } from "@/domain/gameData"

/** In the order the to-do card lists them. */
export const ACTIVITY_GROUPS = ["limited", "gcg", "challenge", "quest", "trial", "banner"] as const
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number]
/** What a quest or area banner leads to: a quest, or an area to explore. */
export type ActivityTag = "quest" | "exploration"

export type Activity = {
  /** Null for an id the bundled data lacks or a nameless activity. */
  name: string | null
  /** The game's activity type without its NEW_ACTIVITY_ prefix; null for an unknown id. */
  type: string | null
  group: ActivityGroup
  /** Only in the quest group. */
  tag?: ActivityTag
}

const table: Record<string, { name: string; type: string }> = data.activities

/** The standing challenges that come back each season. */
const CHALLENGES = new Set(["LEY_LINE_CHALLENGE", "SAVE_TEYVAT", "WEEK_ACTIVE"])
const QUESTS: Record<string, ActivityTag> = {
  MAIN_LINE_BANNER: "quest",
  QUICK_LAUNCH_BANNER: "quest",
  TRIBAL_PERSONAL_LINE_BANNER: "quest",
  LIMITED_TIME_REWARD_AREA_BANNER: "exploration",
  SANDY_LAND_BANNER: "exploration",
}

/** The group of an activity type; anything not singled out is a limited-time event. */
export function activityGroup(type: string | null): Pick<Activity, "group" | "tag"> {
  if (type === null) return { group: "limited" }
  const tag = QUESTS[type]
  if (tag) return { group: "quest", tag }
  if (type === "TRIAL_AVATAR") return { group: "trial" }
  if (type.startsWith("GCG_")) return { group: "gcg" }
  if (CHALLENGES.has(type)) return { group: "challenge" }
  // Promotions: bonus characters, new bosses, Miliastra outfits and the like.
  if (type.includes("BANNER")) return { group: "banner" }
  return { group: "limited" }
}

export function activity(id: number): Activity {
  const entry = Object.hasOwn(table, String(id)) ? table[String(id)] : undefined
  const type = entry?.type ?? null
  return { name: entry?.name || null, type, ...activityGroup(type) }
}
