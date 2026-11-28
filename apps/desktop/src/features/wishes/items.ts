// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Account } from "@/domain/account"
import { lookup } from "@/domain/names"
import { itemOf, type Luck, type PoolKey, type PoolSummary, type Tag } from "@/domain/wishes"
import type { Snapshot } from "@/lib/backend"

/** An item of a wish record by id: its name and icon, or the record's own name. */
export function itemView(itemId: number, fallback = "") {
  const item = itemOf(itemId)
  if (!item) return { name: fallback || String(itemId), icon: undefined, kind: undefined }
  const { name, icon } = lookup(item.kind, item.key)
  return { name, icon, kind: item.kind }
}

/** The tags' colors: won green, guaranteed blue, lost plain, radiance gold. */
export const TAG_TONES: Record<Tag, string> = {
  won: "bg-[color-mix(in_srgb,var(--ok)_18%,transparent)] text-(--ok)",
  guaranteed: "bg-(--accent-soft) text-(--accent-text)",
  lost: "text-muted shadow-[inset_0_0_0_1px_var(--border)]",
  radiance: "bg-(--gold-bg) text-(--gold-fg)",
}

/** A pity number's backing by luck, low in saturation. */
export const LUCK_TONES: Record<Luck, string> = {
  good: "bg-[color-mix(in_srgb,var(--ok)_26%,transparent)]",
  fair: "bg-[color-mix(in_srgb,var(--warn)_24%,transparent)]",
  bad: "bg-[color-mix(in_srgb,var(--err)_24%,transparent)]",
}

/** A bar's fill by luck: the same colors, solid. */
export const LUCK_BARS: Record<Luck, string> = {
  good: "bg-[color-mix(in_srgb,var(--ok)_70%,var(--surface))]",
  fair: "bg-[color-mix(in_srgb,var(--warn)_70%,var(--surface))]",
  bad: "bg-[color-mix(in_srgb,var(--err)_70%,var(--surface))]",
}

/** Event banners tag their five-stars; the others do not. */
export const TAGGED: ReadonlySet<PoolKey> = new Set(["character", "weapon"])

/**
 * The weapon banner's Epitomized Path points: the snapshot's, as of when it
 * was taken, when it has them; else 1 after an off-banner five-star.
 */
export function fateOf(
  pools: readonly PoolSummary[],
  account: Account | undefined,
  snapshot: Snapshot | undefined,
): { points: number; at?: number } {
  const path = account?.tasks?.wishPath
  if (path) return { points: path.points, at: snapshot?.takenAt }
  return { points: pools.find(pool => pool.key === "weapon")?.guaranteed ? 1 : 0 }
}

/** Whether the page leaves a pool out, as the display settings say. */
export function poolHidden(pool: PoolSummary, hideEmpty: boolean, hideNovice: boolean) {
  return (hideEmpty && pool.total === 0) || (hideNovice && pool.key === "novice")
}
