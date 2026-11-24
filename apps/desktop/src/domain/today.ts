// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * What the plan gives the overview's resin plan and the planner's upgrade panel: the domain materials still
 * short that drop today, or tomorrow, and the next step each goal can take.
 */

import { materialData } from "@/domain/names"
import { type Card, type MaterialTotal, stepCost } from "@/domain/plan"
import {
  type Conversion,
  combineSteps,
  openGroup,
  openOn,
  type Step,
  type Talent,
  tierOf,
} from "@/domain/planner"

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

/** A level and its cap, as in 80/90. */
export type Level = { level: number; cap: number }

/** A step as the upgrade panel names it, from where it starts: 80/80 to 80/90, a talent 8 to 9. */
export type UpgradeTarget =
  | { kind: "ascend" | "level"; from: Level; to: Level }
  | { kind: "talent"; talent: Talent; from: number; to: number }

export type Amount = readonly [key: string, count: number]
/** Making a material: what goes in, what converting is paid in among it, and what comes out. */
export type Recipe = { kind: "combine" | "convert"; inputs: Amount[]; output: Amount }

export type UpgradeRow = {
  card: Card
  target: UpgradeTarget
  /** What must be made before the step: combining, the lowest tier first, then converting. */
  recipes: Recipe[]
}

/** Enough to pick from: as one is done, the next goal's step takes its place. */
const UPGRADE_ROWS = 5

/** The first step of each of the first five goals that can take one now, in card order. */
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
  const combined: Recipe[] = []
  const converted: Recipe[] = []
  for (const [key, count] of stepCost(card, step)) {
    const line = card.lines.find(l => l.key === key)
    if (!line) continue
    const conversion = line.converted
    const rest = count - (line.have - line.made - (conversion?.count ?? 0))
    const made = Math.min(rest, line.made)
    for (const s of made > 0 ? combineSteps({ key, made, used: line.used }) : []) {
      combined.push({ kind: "combine", inputs: [[s.from, s.count]], output: [s.to, s.made] })
    }
    if (rest > made && conversion) converted.push(convertRecipe(key, conversion, rest - made))
  }
  const { stage } = card.from
  const levelOf = ({ level, phase }: typeof stage) => ({ level, cap: card.caps[phase] ?? level })
  const target: UpgradeTarget =
    step.kind === "talent"
      ? { kind: "talent", talent: step.talent, from: card.from.talents[step.talent], to: step.to }
      : { kind: step.kind, from: levelOf(stage), to: levelOf(step.to) }
  return { card, target, recipes: [...combined, ...converted] }
}

/**
 * Converting `count` of `key`, part of what `conversion` makes for the whole card: the sources in
 * its order, as many as it takes, and what that many cost.
 */
function convertRecipe(key: string, conversion: Conversion, count: number): Recipe {
  const inputs: Amount[] = []
  let left = count
  for (const [from, n] of conversion.from) {
    if (left <= 0) break
    const take = Math.min(n, left)
    inputs.push([from, take])
    left -= take
  }
  const paid = Math.ceil((conversion.paid * count) / conversion.count)
  return { kind: "convert", inputs: [...inputs, [conversion.cost, paid]], output: [key, count] }
}
