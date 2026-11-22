// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The planner's goals as saved for an account, and each goal worked out
 * against the account: where it stands, what is left to raise, which of it
 * the bag covers, and what can be raised next. savedPlan.ts reads them back.
 */

import type { Account } from "@/domain/account"
import { talentLevels } from "@/domain/builds"
import { type ConvertKind, convertedBy, convertShort } from "@/domain/convert"
import { type CustomSlots, customNeed, familyOptions, unknownSlot } from "@/domain/customCharacter"
import {
  type CustomWeaponRarity,
  type CustomWeaponSlots,
  customWeaponNeed,
  weaponFamilyOptions,
} from "@/domain/customWeapon"
import type { WeaponType } from "@/domain/elements"
import type { Weapon } from "@/domain/good"
import { lookup, materialData, weaponData } from "@/domain/names"
import { DEFAULTS, type Defaults } from "@/domain/planDefaults"
import {
  allocate,
  type CharacterState,
  characterCaps,
  characterNeed,
  compareStages,
  covers,
  defaultOrder,
  isExp,
  type Line,
  type Need,
  START,
  type Stage,
  type Step,
  stageStep,
  TALENTS,
  type Talent,
  weaponCaps,
  weaponNeed,
} from "@/domain/planner"

/** What every goal has; one switched off keeps its place and takes nothing from the bag. */
type GoalBase = { id: string; off?: boolean }
export type CharacterGoal = GoalBase & {
  kind: "character"
  key: string
  /** A talent at 0 is not part of the goal. */
  to: CharacterState
  /** Set when the player reordered the talents; the default order otherwise. */
  order?: Talent[]
}
/** An owned weapon is told apart by the game's id, or in files without ids by its wielder. */
export type WeaponGoal = GoalBase & {
  kind: "weapon"
  key: string
  guid?: string
  wielder?: string
  /** Which of the copies with that wielder, in the account's order. */
  copy?: number
  to: Stage
  /** Set while an event gives this weapon's ore 1.5 times the EXP, as the player says. */
  expBoost?: boolean
}
/** A character not out yet, raised from level 1 and talents 1. */
export type CustomGoal = GoalBase & {
  kind: "custom"
  name: string
  /** Shown only: 4- and 5-star characters cost alike. */
  rarity: 4 | 5
  slots: CustomSlots
  to: CharacterState
  /** Set when the player ordered the talents; there is no default to show till then. */
  order?: Talent[]
}
/** A weapon not out yet, raised from level 1. */
export type CustomWeaponGoal = GoalBase & {
  kind: "customWeapon"
  name: string
  rarity: CustomWeaponRarity
  /** Left out till the player knows it; it decides which passive halves the ascension Mora. */
  type?: WeaponType
  slots: CustomWeaponSlots
  to: Stage
  expBoost?: boolean
}
export type Goal = CharacterGoal | WeaponGoal | CustomGoal | CustomWeaponGoal
/** Raise the most important talent first, or any talent the bag covers. */
export type TalentFocus = "important" | "ready"
export const FOCUSES = ["important", "ready"] as const
export type Plan = {
  goals: Goal[]
  focus: TalentFocus
  defaults: Defaults
  /** The summary's groups (summaryGroup ids) the player has moved, in their order. */
  summaryOrder?: string[]
  /** The conversions the player allows the plan to count on; none when left out. */
  convert?: ConvertKind[]
}
export const EMPTY_PLAN: Plan = { goals: [], focus: "important", defaults: DEFAULTS }

/** A weapon's goal, released or not, which is a level goal alone. */
export function isWeaponGoal(goal: Goal): goal is WeaponGoal | CustomWeaponGoal {
  return goal.kind === "weapon" || goal.kind === "customWeapon"
}

/**
 * Characters whose passive, there from the start, halves the Mora for
 * ascending weapons of some types; owning one is enough.
 */
const MORA_PASSIVES = [
  { key: "RaidenShogun", types: ["sword", "polearm"] },
  { key: "Wanderer", types: ["bow", "catalyst"] },
] as const
export type MoraDiscount = (typeof MORA_PASSIVES)[number]["key"]

/** Where a goal's item stands in the account; a custom one is not out yet. */
export type Standing = "owned" | "unowned" | "otherElement" | "missing" | "custom"

export type Card = {
  goal: Goal
  standing: Standing
  from: CharacterState
  caps: readonly number[]
  need: Need
  /** The materials the level goal needs; the rest are for talents. */
  stageKeys: ReadonlySet<string>
  /** Who wields an owned weapon: a character key, "Traveler" or "". */
  wielder?: string
  /** Whose passive halves this weapon's ascension Mora, when the account has them. */
  moraDiscount?: MoraDiscount
  /** The levels constellations add to each talent; all 0 when it has none or is not owned. */
  bonus: Record<Talent, number>
  /** Switched off: no lines, never done, no steps. */
  off: boolean
  lines: Line[]
  done: boolean
  /** What can be raised next with what the card gets; empty when nothing can. */
  steps: Step[]
}

/** A weapon as a goal names it: an owned one by its ids, an unowned one by its key alone. */
export type WeaponPick = Pick<WeaponGoal, "key" | "guid" | "wielder" | "copy">

/** The owned weapon a goal is for: by id, or in files without ids by name, wielder and copy. */
export function findWeapon(account: Account, goal: WeaponPick): Weapon | undefined {
  if (goal.guid && account.weapons.some(w => w.guid)) {
    return account.weapons.find(w => w.guid === goal.guid)
  }
  if (goal.wielder === undefined) return undefined
  const copies = account.weapons.filter(w => w.key === goal.key && w.location === goal.wielder)
  return copies[goal.copy ?? 0]
}

/** Whether a weapon goal is for `pick`: the same owned weapon, or the same unowned one. */
export function weaponPlanned(plan: Plan, account: Account, pick: WeaponPick) {
  const goals = plan.goals.filter(goal => goal.kind === "weapon")
  if (pick.guid === undefined && pick.wielder === undefined) {
    return goals.some(g => g.key === pick.key && !g.guid && g.wielder === undefined)
  }
  const own = findWeapon(account, pick)
  return own !== undefined && goals.some(g => findWeapon(account, g) === own)
}

function stageOf(item: { level: number; ascension: number }): Stage {
  return { level: item.level, phase: item.ascension }
}

/**
 * Where a character is now, and how it stands in the account. Exports hold
 * only the Traveler's current element's talents, so the other elements start
 * at talents 1 with the level all elements share.
 */
export function characterFrom(account: Account, key: string): [CharacterState, Standing] {
  const own = account.characters.find(c => c.key === key)
  if (own) return [{ stage: stageOf(own), talents: { ...own.talent } }, "owned"]
  const traveler = key.startsWith("Traveler")
    ? account.characters.find(c => c.key.startsWith("Traveler"))
    : undefined
  return traveler ? [{ ...START, stage: stageOf(traveler) }, "otherElement"] : [START, "unowned"]
}

/**
 * The +3 constellations 3 and 5 give an owned character's talents; goals for
 * plans store and cost the base levels. The Traveler's other elements have
 * none, as exports hold only the current element's constellations.
 */
function talentBonus(account: Account, goal: Goal): Record<Talent, number> {
  const own = goal.kind === "character" && account.characters.find(c => c.key === goal.key)
  const levels = own ? talentLevels(own) : undefined
  const bonus = (talent: Talent) => (levels ? levels[talent].total - levels[talent].base : 0)
  return { auto: bonus("auto"), skill: bonus("skill"), burst: bonus("burst") }
}

function weaponFrom(account: Account, goal: WeaponGoal): [Stage, Standing, string?] {
  const own = findWeapon(account, goal)
  if (own) return [stageOf(own), "owned", own.location]
  const owned = goal.guid !== undefined || goal.wielder !== undefined
  return [START.stage, owned ? "missing" : "unowned"]
}

/** Where a goal's item is now; a weapon's talents stay at START's. */
function startOf(account: Account, goal: Goal): [CharacterState, Standing, string?] {
  if (goal.kind === "custom" || goal.kind === "customWeapon") return [START, "custom"]
  if (goal.kind === "character") return characterFrom(account, goal.key)
  const [stage, standing, wielder] = weaponFrom(account, goal)
  return [{ ...START, stage }, standing, wielder]
}

function targetOf(goal: Goal, from: CharacterState): CharacterState {
  return isWeaponGoal(goal) ? { ...from, stage: goal.to } : goal.to
}

function capsOf(goal: Goal) {
  if (goal.kind === "weapon") return weaponCaps(rarityOf(goal.key))
  return goal.kind === "customWeapon" ? weaponCaps(goal.rarity) : characterCaps()
}

function moraDiscountOf(goal: Goal, account: Account): MoraDiscount | undefined {
  const type =
    goal.kind === "weapon"
      ? weaponData(goal.key).type
      : goal.kind === "customWeapon"
        ? goal.type
        : undefined
  const passive = MORA_PASSIVES.find(p => p.types.some(t => t === type))
  return passive && account.characters.some(c => c.key === passive.key) ? passive.key : undefined
}

/** What raising a goal's item from `from` to `to` costs. */
function needOf(goal: Goal, from: CharacterState, to: CharacterState, discount?: MoraDiscount) {
  if (isWeaponGoal(goal)) {
    const terms = { halfMora: discount !== undefined, expBoost: goal.expBoost }
    if (goal.kind === "weapon") {
      return weaponNeed(goal.key, rarityOf(goal.key), from.stage, to.stage, terms)
    }
    return customWeaponNeed(goal.rarity, goal.slots, from.stage, to.stage, terms)
  }
  if (goal.kind === "custom") return customNeed(goal.slots, from, to)
  return characterNeed(goal.key, from, to)
}

/** The player's order of talents, else the game's; a custom character's has none to fall back on. */
export function talentOrder(goal: CharacterGoal | CustomGoal): Talent[] {
  return goal.order ?? (goal.kind === "custom" ? [...TALENTS] : defaultOrder(goal.key))
}

/** What one step costs from where the card's item is now. */
export function stepCost(card: Pick<Card, "goal" | "from" | "moraDiscount">, step: Step): Need {
  const { goal, from, moraDiscount } = card
  const to =
    step.kind === "talent"
      ? { ...from, talents: { ...from.talents, [step.talent]: step.to } }
      : { ...from, stage: step.to }
  return needOf(goal, from, to, moraDiscount)
}

/** `base` is where the card's costs count from: past `from` when a card before raises the level. */
function nextSteps(card: Omit<Card, "steps">, base: Stage, focus: TalentFocus): Step[] {
  const { goal, from, caps, lines } = card
  const covered = (step: Step) => covers(lines, stepCost(card, step))
  const step = stageStep(from.stage, targetOf(goal, from).stage, caps)
  if (step && compareStages(from.stage, base) < 0) return []
  if (step) return covered(step) ? [step] : []
  if (isWeaponGoal(goal)) return []
  const open = talentOrder(goal).filter(t => from.talents[t] < goal.to.talents[t])
  const candidates = focus === "important" ? open.slice(0, 1) : open
  return candidates
    .map((talent): Step => ({ kind: "talent", talent, to: from.talents[talent] + 1 }))
    .filter(covered)
}

/**
 * Every goal worked out against the account, the bag shared among them in
 * order, goals switched off left out, then what is still short made up by
 * the conversions the plan allows. Every element of the Traveler shares one
 * level, which a card counts only past what the Traveler cards before it
 * raise it to.
 */
export function planCards(
  plan: Pick<Plan, "goals" | "focus" | "convert">,
  account: Account,
  bag: ReadonlyMap<string, number>,
) {
  let traveler: Stage | undefined
  const partial = plan.goals.map(goal => {
    const [from, standing, wielder] = startOf(account, goal)
    const to = targetOf(goal, from)
    const caps = capsOf(goal)
    const off = goal.off === true
    const shared = goal.kind === "character" && goal.key.startsWith("Traveler")
    const base =
      shared && traveler && compareStages(traveler, from.stage) > 0
        ? { ...from, stage: traveler }
        : from
    if (shared && !off && compareStages(to.stage, base.stage) > 0) traveler = to.stage
    const moraDiscount = moraDiscountOf(goal, account)
    const stageOnly = needOf(goal, base, { ...base, stage: to.stage }, moraDiscount)
    const need = needOf(goal, base, to, moraDiscount)
    const stageKeys = new Set(stageOnly.keys())
    const bonus = talentBonus(account, goal)
    const card = { goal, standing, from, caps, need, stageKeys, wielder, moraDiscount, bonus, off }
    return { card, base: base.stage, reached: compareStages(from.stage, to.stage) >= 0 }
  })
  // An empty need takes nothing, so the cards after one switched off share the bag without it.
  const allLines = convertShort(
    allocate(
      partial.map(({ card }) => (card.off ? new Map() : card.need)),
      bag,
    ),
    bag,
    plan.convert ?? [],
  )
  return partial.map(({ card, base, reached }, i): Card => {
    const lines = allLines[i] ?? []
    // What converting a level goal's material costs goes with that goal's materials.
    const stageKeys = new Set(card.stageKeys)
    for (const { key, converted } of lines) {
      if (converted && stageKeys.has(key)) stageKeys.add(converted.cost)
    }
    const done = !card.off && reached && card.need.size === 0
    const worked = { ...card, stageKeys, lines, done }
    const steps = worked.done || card.off ? [] : nextSteps(worked, base, plan.focus)
    return { ...worked, steps }
  })
}

export function goalName(goal: Goal) {
  if (goal.kind === "custom" || goal.kind === "customWeapon") return goal.name
  return lookup(goal.kind === "weapon" ? "weapons" : "characters", goal.key).name
}

/** A material over every card: what they need, what they get, and the goals that need it. */
export type MaterialTotal = { key: string; need: number; have: number; goals: string[] }

/**
 * Every card's materials added up, each with the names of the goals that need
 * it in card order. Goals switched off have no lines, so they are left out.
 */
export function materialTotals(cards: readonly Card[]): Map<string, MaterialTotal> {
  const totals = new Map<string, MaterialTotal>()
  for (const card of cards) {
    for (const line of card.lines) {
      const total = totals.get(line.key) ?? { key: line.key, need: 0, have: 0, goals: [] }
      total.need += line.need
      total.have += line.have
      total.goals.push(goalName(card.goal))
      totals.set(line.key, total)
    }
  }
  return totals
}

/** The summary's own groups; the others are the game's material types. */
export const MORA_EXP_GROUP = "moraExp"
export const SPECIALTY_GROUP = "specialty"
export const WORLD_BOSS_GROUP = "worldBoss"
export const WEEKLY_BOSS_GROUP = "weeklyBoss"

// World and weekly bosses' drops share one type in the game.
const WORLD_BOSS = new Set(familyOptions("boss").flat())
const WEEKLY_BOSS = new Set(familyOptions("weekly").flat())

/**
 * A known material standing for one of a custom goal's that is not known
 * yet: the slot's first family's at the same tier, of the same type and
 * rarity.
 */
export function knownLike(key: string) {
  const unknown = unknownSlot(key)
  if (!unknown) return key
  const families =
    unknown.of === "weapon" ? weaponFamilyOptions(unknown.slot) : familyOptions(unknown.slot)
  return families[0]?.[unknown.tier] ?? families[0]?.at(-1) ?? key
}

/**
 * The summary group a material goes in: Mora with EXP, every region's
 * specialties together, world and weekly bosses' drops apart, the rest by the
 * game's material type, those not known yet with the known ones of their
 * slot, what conversions are paid in with what they convert. A type goes by
 * its name, the one id names.json keeps for it.
 */
export function summaryGroup(key: string) {
  const known = convertedBy(key) ?? knownLike(key)
  if (known === "Mora" || isExp(known)) return MORA_EXP_GROUP
  if (WORLD_BOSS.has(known)) return WORLD_BOSS_GROUP
  if (WEEKLY_BOSS.has(known)) return WEEKLY_BOSS_GROUP
  const data = materialData(known)
  if (data.tab === "specialty") return SPECIALTY_GROUP
  return data.type ?? ""
}

/**
 * The summary's groups, `ids` in their default order, as the player ordered
 * them in `saved`; those never moved keep their default place.
 */
export function orderGroups(ids: readonly string[], saved: readonly string[] = []) {
  const moved = saved.filter(id => ids.includes(id))
  let next = 0
  return ids.map(id => (saved.includes(id) ? (moved[next++] ?? id) : id))
}

/** Every weapon the planner has data for is in names.json, which gives its rarity. */
function rarityOf(key: string) {
  return weaponData(key).rarity ?? 5
}
