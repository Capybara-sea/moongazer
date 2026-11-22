// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** A plan as saved, read back with what no longer checks out left out or set to the default. */

import { familyOptions, SLOTS } from "@/domain/customCharacter"
import { CUSTOM_WEAPON_RARITIES, WEAPON_SLOTS, weaponFamilyOptions } from "@/domain/customWeapon"
import { isWeaponType } from "@/domain/elements"
import {
  EMPTY_PLAN,
  FOCUSES,
  type Goal,
  MORA_EXP_GROUP,
  type Plan,
  SPECIALTY_GROUP,
  WEEKLY_BOSS_GROUP,
  WORLD_BOSS_GROUP,
} from "@/domain/plan"
import { DEFAULTS, type Defaults } from "@/domain/planDefaults"
import {
  type CharacterState,
  characterCaps,
  compareStages,
  isPlannable,
  type Stage,
  stages,
  TALENTS,
  type Talent,
  weaponCaps,
} from "@/domain/planner"
import names from "@/generated/names.json"
import { isOneOf, isRecord } from "@/lib/backend/shared"

const isLevel = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max
const isTalentGoal = (value: unknown): value is number => value === 0 || isLevel(value, 10)
const isPhase = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6
const isCopy = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0

function parseStage(value: unknown): Stage | undefined {
  if (!isRecord(value) || !isLevel(value.level, 90) || !isPhase(value.phase)) return undefined
  return { level: value.level, phase: value.phase }
}

function parseTarget(value: unknown): CharacterState | undefined {
  const to = isRecord(value) ? value : {}
  const stage = parseStage(to.stage)
  const { auto, skill, burst } = isRecord(to.talents) ? to.talents : {}
  if (!stage || !isTalentGoal(auto) || !isTalentGoal(skill) || !isTalentGoal(burst)) {
    return undefined
  }
  return { stage, talents: { auto, skill, burst } }
}

function parseOrder(value: unknown): Talent[] | undefined {
  const order = Array.isArray(value) ? value.filter(t => isOneOf(TALENTS, t)) : []
  return order.length === 3 && new Set(order).size === 3 ? order : undefined
}

/** A slot whose family is no longer in the data goes back to not known. */
function parseSlots<S extends string>(
  value: unknown,
  slots: readonly S[],
  families: (slot: S) => readonly string[][],
): Partial<Record<S, string>> {
  const saved = isRecord(value) ? value : {}
  const known: Partial<Record<S, string>> = {}
  for (const slot of slots) {
    const top = saved[slot]
    if (typeof top !== "string") continue
    if (families(slot).some(family => family.at(-1) === top)) known[slot] = top
  }
  return known
}

/** A switch as saved: on when true, else left out. */
const flag = (value: unknown) => value === true || undefined

function parseCustom(id: string, value: Record<string, unknown>): Goal | undefined {
  const name = typeof value.name === "string" ? value.name.trim() : ""
  if (!name) return undefined
  if (value.kind === "customWeapon") {
    const rarity = CUSTOM_WEAPON_RARITIES.find(r => r === value.rarity)
    const to = parseStage(value.to)
    if (rarity === undefined || !to) return undefined
    const slots = parseSlots(value.slots, WEAPON_SLOTS, weaponFamilyOptions)
    const type = isWeaponType(value.type) ? value.type : undefined
    const expBoost = flag(value.expBoost)
    return { id, kind: "customWeapon", name, rarity, type, slots, to, expBoost }
  }
  const rarity = value.rarity === 4 || value.rarity === 5 ? value.rarity : undefined
  const to = parseTarget(value.to)
  if (!rarity || !to) return undefined
  const slots = parseSlots(value.slots, SLOTS, familyOptions)
  return { id, kind: "custom", name, rarity, slots, to, order: parseOrder(value.order) }
}

function parseGoal(value: unknown): Goal | undefined {
  if (!isRecord(value)) return undefined
  const goal = parseKind(value)
  return goal && flag(value.off) ? { ...goal, off: true } : goal
}

function parseKind(value: Record<string, unknown>): Goal | undefined {
  if (typeof value.id !== "string") return undefined
  const { id } = value
  if (value.kind === "custom" || value.kind === "customWeapon") return parseCustom(id, value)
  if (typeof value.key !== "string") return undefined
  const { key } = value
  if (value.kind === "weapon") {
    const to = parseStage(value.to)
    if (!to || !isPlannable("weapon", key)) return undefined
    return {
      id,
      kind: "weapon",
      key,
      to,
      guid: typeof value.guid === "string" ? value.guid : undefined,
      wielder: typeof value.wielder === "string" ? value.wielder : undefined,
      copy: isCopy(value.copy) ? value.copy : undefined,
      expBoost: flag(value.expBoost),
    }
  }
  if (value.kind !== "character" || !isPlannable("character", key)) return undefined
  const to = parseTarget(value.to)
  if (!to) return undefined
  return { id, kind: "character", key, to, order: parseOrder(value.order) }
}

/** One of the stages the level picker offers for `caps`. */
function parseStageOf(value: unknown, caps: readonly number[]): Stage | undefined {
  const stage = parseStage(value)
  if (!stage || !stages(caps).some(s => compareStages(s, stage) === 0)) return undefined
  return stage
}

/** Plans saved before there were defaults, and defaults that do not check out, get ours. */
function parseDefaults(value: unknown): Defaults {
  const saved = isRecord(value) ? value : {}
  const character = isRecord(saved.character) ? saved.character : {}
  const talents: unknown[] = Array.isArray(character.talents) ? character.talents : []
  const rank = (i: 0 | 1 | 2) => {
    const level = talents[i]
    return isLevel(level, 10) ? level : DEFAULTS.character.talents[i]
  }
  return {
    character: {
      stage: parseStageOf(character.stage, characterCaps()) ?? DEFAULTS.character.stage,
      talents: [rank(0), rank(1), rank(2)],
    },
    weapon: parseStageOf(saved.weapon, weaponCaps(5)) ?? DEFAULTS.weapon,
  }
}

const GROUPS = new Set([
  MORA_EXP_GROUP,
  SPECIALTY_GROUP,
  WEEKLY_BOSS_GROUP,
  WORLD_BOSS_GROUP,
  ...names.materialTypes.filter(t => t.tab !== "specialty").map(t => t.name),
])

/** The summary's order without groups the data no longer has, or repeats; none when empty. */
function parseSummaryOrder(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const ids = new Set(value.filter((id): id is string => typeof id === "string" && GROUPS.has(id)))
  return ids.size > 0 ? [...ids] : undefined
}

/** A saved plan; goals that no longer check out, such as a removed weapon's, are left out. */
export function parsePlan(value: unknown): Plan {
  if (!isRecord(value)) return EMPTY_PLAN
  const goals = Array.isArray(value.goals) ? value.goals.flatMap(g => parseGoal(g) ?? []) : []
  const focus = isOneOf(FOCUSES, value.focus) ? value.focus : EMPTY_PLAN.focus
  const summaryOrder = parseSummaryOrder(value.summaryOrder)
  return { goals, focus, defaults: parseDefaults(value.defaults), summaryOrder }
}
