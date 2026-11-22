// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * What the plan gives the home page's "today": the domain materials still
 * short that drop today, or tomorrow, and the next step each goal can take.
 */

import { materialData } from "@/domain/names"
import { type Card, type MaterialTotal, stepCost } from "@/domain/plan"
import { openGroup, openOn, type Step, type Talent, tierOf } from "@/domain/planner"

type Totals = ReadonlyMap<string, MaterialTotal>

/**
 * The domain materials (talent books, weapon ascension materials) still short
 * after combining that drop on `weekday` (0 Monday): by the game's material
 * type, lower tiers first.
 */
export function farmToday(totals: Totals, weekday: number): MaterialTotal[] {
  const rank = (key: string) => materialData(key).typeOrder ?? 999
  return [...totals.values()]
    .filter(total => {
      const group = openGroup(total.key)
      return group !== undefined && total.have < total.need && openOn(group, weekday)
    })
    .toSorted((a, b) => rank(a.key) - rank(b.key) || tierOf(a.key) - tierOf(b.key))
}

/** Those that drop the day after `weekday`, for a day none drops. */
export function farmTomorrow(totals: Totals, weekday: number): MaterialTotal[] {
  return farmToday(totals, (weekday + 1) % 7)
}

/** A step as the home page names it: ascend to 80/90, level to 90, a talent from 8 to 9. */
export type UpgradeTarget =
  | { kind: "ascend" | "level"; level: number; cap: number }
  | { kind: "talent"; talent: Talent; from: number; to: number }

export type UpgradeRow = {
  card: Card
  target: UpgradeTarget
  /** What must be combined from the tiers below before the step, and how many. */
  combine: { key: string; count: number }[]
  /** What must be converted from others of the same tier before the step, and how many. */
  convert: { key: string; count: number }[]
}

const UPGRADE_ROWS = 6

/** The first step of each of the first six goals that can take one now, in card order. */
export function upgradeRows(cards: readonly Card[]): UpgradeRow[] {
  return cards
    .filter(card => card.steps.length > 0)
    .slice(0, UPGRADE_ROWS)
    .flatMap(card => card.steps.slice(0, 1).map(step => rowOf(card, step)))
}

/**
 * What the bag holds for the card goes to the step first; the rest of the
 * step's cost is what combining makes, then what converting makes, which the
 * card's lines count in.
 */
function rowOf(card: Card, step: Step): UpgradeRow {
  const combine: UpgradeRow["combine"] = []
  const convert: UpgradeRow["convert"] = []
  for (const [key, count] of stepCost(card, step)) {
    const line = card.lines.find(l => l.key === key)
    if (!line) continue
    const converted = line.converted?.count ?? 0
    const rest = count - (line.have - line.made - converted)
    const made = Math.min(rest, line.made)
    if (made > 0) combine.push({ key, count: made })
    if (rest > made) convert.push({ key, count: rest - made })
  }
  const target: UpgradeTarget =
    step.kind === "talent"
      ? { kind: "talent", talent: step.talent, from: card.from.talents[step.talent], to: step.to }
      : { kind: step.kind, level: step.to.level, cap: card.caps[step.to.phase] ?? step.to.level }
  return { card, target, combine, convert }
}
