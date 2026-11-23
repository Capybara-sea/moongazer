// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * What raising characters and weapons to their goals costs, which of it the
 * bag covers card by card, and what can be raised next. Costs come from
 * generated/planner.json; EXP and Mora for levels are counted from the start
 * of a level, as exports do not say how far into it a character is.
 */

import data from "@/generated/planner.json"

export type Talent = "auto" | "skill" | "burst"
export const TALENTS: readonly Talent[] = ["auto", "skill", "burst"]
export type Levels = Record<Talent, number>
/** A level and the ascensions done; level 80 after 6 is the game's 80/90, shown as "80★". */
export type Stage = { level: number; phase: number }
/** Material key to count; EXP goes under the two keys below. */
export type Need = Map<string, number>

export const CHARACTER_EXP = "exp:character"
export const WEAPON_EXP = "exp:weapon"
/** The game charges 1 Mora per 5 EXP for characters and per 10 for weapons. */
const MORA_PER_EXP = { [CHARACTER_EXP]: 0.2, [WEAPON_EXP]: 0.1 }

/** JSON imports type each cost with the other costs' keys as optional. */
export type Cost = Record<string, number | undefined>
type Table = {
  costs: Cost[][]
  characters: Record<string, { ascension: number; talents: number[]; order: string[] }>
  weapons: Record<string, { ascension: number }>
  characterCaps: number[]
  weaponCaps: Record<string, number[]>
  talentAscension: number[]
  characterExp: number[]
  weaponExp: Record<string, number[]>
  characterExpItems: Record<string, number>
  weaponExpItems: Record<string, number>
  combine: Record<string, string>
  combineMora: Record<string, number>
  openDays: Record<string, number>
}

const table: Table = data

export function isPlannable(kind: "character" | "weapon", key: string) {
  return key in (kind === "character" ? table.characters : table.weapons)
}

export function plannableKeys(kind: "character" | "weapon") {
  return Object.keys(kind === "character" ? table.characters : table.weapons)
}

/** The game's order of talents most worth raising, or ours where the game gives none. */
export function defaultOrder(key: string): Talent[] {
  const order = table.characters[key]?.order ?? []
  return order.length === 3 ? (order as Talent[]) : [...TALENTS]
}

export function characterCaps() {
  return table.characterCaps
}

export function weaponCaps(rarity: number) {
  return table.weaponCaps[rarity] ?? table.characterCaps
}

/** The highest talent level `phase` ascensions allow. */
export function talentCap(phase: number) {
  return table.talentAscension.findLastIndex(need => need <= phase) + 1
}

/** The ascensions a talent level needs. */
export function talentPhase(level: number) {
  return table.talentAscension[level - 1] ?? 0
}

/** Every stage a goal can name, lowest first: 1, 20, 20★, 40, 40★, … the last cap. */
export function stages(caps: readonly number[]): Stage[] {
  const out: Stage[] = [{ level: 1, phase: 0 }]
  caps.forEach((cap, phase) => {
    out.push({ level: cap, phase })
    if (phase < caps.length - 1) out.push({ level: cap, phase: phase + 1 })
  })
  return out
}

export function compareStages(a: Stage, b: Stage) {
  return a.phase - b.phase || a.level - b.level
}

/** Ascended and not yet levelled past the old cap, which the game shows as 80/90. */
export function waitsToLevel(stage: Stage, caps: readonly number[]) {
  return stage.phase > 0 && stage.level === caps[stage.phase - 1]
}

/** The lowest stage `phase` ascensions reach. */
export function stageAt(phase: number, caps: readonly number[]): Stage {
  return { level: phase === 0 ? 1 : (caps[phase - 1] ?? 1), phase }
}

function add(need: Need, cost: Cost | undefined) {
  for (const [key, count = 0] of Object.entries(cost ?? {})) {
    need.set(key, (need.get(key) ?? 0) + count)
  }
}

function addExp(need: Need, key: typeof CHARACTER_EXP | typeof WEAPON_EXP, exp: number) {
  if (exp <= 0) return
  need.set(key, (need.get(key) ?? 0) + exp)
  need.set("Mora", (need.get("Mora") ?? 0) + Math.ceil(exp * MORA_PER_EXP[key]))
}

function expBetween(list: readonly number[], from: number, to: number) {
  let sum = 0
  for (let level = from; level < to; level++) sum += list[level - 1] ?? 0
  return sum
}

/** Ascensions after `from.phase` up to `to.phase`, and the levels between at EXP / `boost`. */
function stageNeed(
  need: Need,
  ascension: Cost[] | undefined,
  exp: readonly number[],
  expKey: typeof CHARACTER_EXP | typeof WEAPON_EXP,
  from: Stage,
  to: Stage,
  boost = 1,
) {
  if (compareStages(from, to) >= 0) return
  for (let phase = from.phase + 1; phase <= to.phase; phase++) add(need, ascension?.[phase - 1])
  addExp(need, expKey, Math.ceil(expBetween(exp, from.level, to.level) / boost))
}

function talentNeed(need: Need, list: Cost[] | undefined, from: number, to: number) {
  for (let level = from + 1; level <= to; level++) add(need, list?.[level - 2])
}

export type CharacterState = { stage: Stage; talents: Levels }

/** What raising a character costs by its ascensions' costs and its talents' in TALENTS order. */
export function raiseNeed(
  ascension: Cost[] | undefined,
  talents: readonly (Cost[] | undefined)[],
  from: CharacterState,
  to: CharacterState,
): Need {
  const need: Need = new Map()
  stageNeed(need, ascension, table.characterExp, CHARACTER_EXP, from.stage, to.stage)
  TALENTS.forEach((talent, i) => {
    talentNeed(need, talents[i], from.talents[talent], to.talents[talent])
  })
  return need
}

export function characterNeed(key: string, from: CharacterState, to: CharacterState): Need {
  const entry = table.characters[key]
  if (!entry) return new Map()
  const talents = entry.talents.map(at => table.costs[at])
  return raiseNeed(table.costs[entry.ascension], talents, from, to)
}

/**
 * What changes a weapon's costs: a character's passive that halves the Mora
 * for ascending it, and an event that gives its ore 1.5 times the EXP, which
 * cuts the ore and the Mora for levelling with it, as that goes by the ore.
 */
export type WeaponTerms = { halfMora?: boolean; expBoost?: boolean }

export function weaponNeed(
  key: string,
  rarity: number,
  from: Stage,
  to: Stage,
  terms: WeaponTerms = {},
): Need {
  const entry = table.weapons[key]
  return entry ? raiseWeaponNeed(table.costs[entry.ascension], rarity, from, to, terms) : new Map()
}

function halveMora(cost: Cost): Cost {
  return cost.Mora === undefined ? cost : { ...cost, Mora: Math.ceil(cost.Mora / 2) }
}

/** What raising a weapon of `rarity` costs by its ascensions' costs. */
export function raiseWeaponNeed(
  ascension: Cost[] | undefined,
  rarity: number,
  from: Stage,
  to: Stage,
  terms: WeaponTerms = {},
) {
  const need: Need = new Map()
  const costs = terms.halfMora ? ascension?.map(halveMora) : ascension
  const exp = table.weaponExp[rarity] ?? []
  stageNeed(need, costs, exp, WEAPON_EXP, from, to, terms.expBoost ? 1.5 : 1)
  return need
}

/** One step's cost: the next ascension, the levels up to the cap or goal, or a talent level. */
export type StageStep = { kind: "ascend" | "level"; to: Stage }
export type Step = StageStep | { kind: "talent"; talent: Talent; to: number }

/** The step that raises `from` toward `to`; none when `from` is there. */
export function stageStep(from: Stage, to: Stage, caps: readonly number[]): StageStep | undefined {
  if (compareStages(from, to) >= 0) return undefined
  if (from.level >= (caps[from.phase] ?? 0)) {
    return { kind: "ascend", to: { level: from.level, phase: from.phase + 1 } }
  }
  const level = to.phase === from.phase ? to.level : (caps[from.phase] ?? from.level)
  return { kind: "level", to: { level, phase: from.phase } }
}

/** The item EXP is shown in: the one that gives the most. */
export function expUnit(key: string): { item: string; exp: number } | undefined {
  const items = key === CHARACTER_EXP ? table.characterExpItems : table.weaponExpItems
  if (key !== CHARACTER_EXP && key !== WEAPON_EXP) return undefined
  const [item, exp] = Object.entries(items).toSorted(([, a], [, b]) => b - a)[0] ?? []
  return item === undefined || exp === undefined ? undefined : { item, exp }
}

export function isExp(key: string) {
  return key === CHARACTER_EXP || key === WEAPON_EXP
}

/** How many tiers below a material combine into it, for listing lower tiers first. */
export function tierOf(key: string) {
  return depth(key)
}

/** The bag as the planner counts it: EXP items as their EXP, the rest as they are. */
export function plannerBag(materials: ReadonlyMap<string, number>): Map<string, number> {
  const bag = new Map(materials)
  const pool = (items: Record<string, number>) =>
    Object.entries(items).reduce((sum, [key, exp]) => sum + (materials.get(key) ?? 0) * exp, 0)
  bag.set(CHARACTER_EXP, pool(table.characterExpItems))
  bag.set(WEAPON_EXP, pool(table.weaponExpItems))
  return bag
}

export type Line = {
  key: string
  need: number
  /** What this card gets, combined ones included; at most `need`. */
  have: number
  /** Of `have`, how many come from combining three of the tier below. */
  made: number
  /** What combining took: the tiers below, the ones made on the way included, and Mora. */
  used: Need
  /** What the bag held for this card, after the cards before it. */
  bag: number
  /** Of `have`, what converting others of the same tier made, when the plan allows it. */
  converted?: Conversion
}

/** How many converting made, from how many of which materials, and what it cost of which item. */
export type Conversion = { count: number; from: Need; cost: string; paid: number }

/** The material three of which make one of `key`. */
export function lowerTier(key: string): string | undefined {
  return table.combine[key]
}

function depth(key: string): number {
  const lower = table.combine[key]
  return lower === undefined ? 0 : depth(lower) + 1
}

function makeable(key: string, left: Map<string, number>): number {
  const lower = table.combine[key]
  if (lower === undefined) return 0
  return Math.floor(((left.get(lower) ?? 0) + makeable(lower, left)) / 3)
}

/** What making `count` of `key` takes, from the tier below first; `makeable` must allow it. */
function combining(key: string, count: number, left: ReadonlyMap<string, number>): Need {
  const used: Need = new Map()
  let mora = 0
  for (let item = key, n = count; n > 0; ) {
    const lower = table.combine[item]
    if (lower === undefined) break
    mora += n * (table.combineMora[item] ?? 0)
    const taken = Math.min(left.get(lower) ?? 0, n * 3)
    if (taken > 0) used.set(lower, taken)
    n = n * 3 - taken
    item = lower
  }
  if (mora > 0) used.set("Mora", mora)
  return used
}

/** A step of combining: `count` of `from` make `made` of `to`. */
export type CombineStep = { from: string; count: number; to: string; made: number }

/**
 * The steps combining took to make up `line`, the lowest tier first: each takes three of the
 * tier below for one, what the bag had of that tier and what the step before made.
 */
export function combineSteps(line: Pick<Line, "key" | "made" | "used">): CombineStep[] {
  const steps: CombineStep[] = []
  for (let item = line.key, n = line.made; n > 0; ) {
    const lower = table.combine[item]
    if (lower === undefined) break
    steps.push({ from: lower, count: n * 3, to: item, made: n })
    n = n * 3 - (line.used.get(lower) ?? 0)
    item = lower
  }
  return steps.reverse()
}

/**
 * Shares the bag among the cards in order: each card takes what it needs of
 * each material, then makes up what is short by combining what is left of
 * the tiers below, as far as the Mora left pays for it, before the next card
 * gets the rest.
 */
export function allocate(needs: readonly Need[], bag: ReadonlyMap<string, number>): Line[][] {
  const left = new Map(bag)
  return needs.map(need => {
    const lines = [...need].map(([key, count]): Line => {
      const held = left.get(key) ?? 0
      const have = Math.min(count, held)
      left.set(key, held - have)
      return { key, need: count, have, made: 0, bag: held, used: new Map() }
    })
    for (const line of lines.toSorted((a, b) => depth(a.key) - depth(b.key))) {
      let made = Math.min(line.need - line.have, makeable(line.key, left))
      let used = combining(line.key, made, left)
      while (made > 0 && (used.get("Mora") ?? 0) > (left.get("Mora") ?? 0)) {
        made--
        used = combining(line.key, made, left)
      }
      if (made <= 0) continue
      for (const [key, count] of used) left.set(key, (left.get(key) ?? 0) - count)
      line.have += made
      line.made = made
      line.used = used
    }
    return lines
  })
}

/** Whether a card's lines cover `cost`, the first part of what it needs. */
export function covers(lines: readonly Line[], cost: Need) {
  return [...cost].every(([key, count]) => (lines.find(l => l.key === key)?.have ?? 0) >= count)
}

/** The day group a domain material drops in: see `openOn`. */
export function openGroup(key: string): number | undefined {
  return table.openDays[key]
}

/** Whether a material of `group` drops on `weekday` (0 Monday); every one drops on Sunday. */
export function openOn(group: number, weekday: number) {
  return weekday === 6 || weekday % 3 === group
}

export const START: CharacterState = {
  stage: { level: 1, phase: 0 },
  talents: { auto: 1, skill: 1, burst: 1 },
}
