// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * What a new goal aims at by the plan's defaults, which the player sets for
 * the account: a character's level and its talents by rank, and a weapon's
 * level.
 */

import {
  type CharacterState,
  compareStages,
  type Levels,
  type Stage,
  stageAt,
  stages,
  TALENTS,
  type Talent,
  talentPhase,
} from "@/domain/planner"

/** `talents` by rank, the most important talent's first. */
export type Defaults = {
  character: { stage: Stage; talents: [number, number, number] }
  weapon: Stage
}

/** Level 90 and talents 9, 9 and 6; a weapon as far as it goes. */
export const DEFAULTS: Defaults = {
  character: { stage: { level: 90, phase: 6 }, talents: [9, 9, 6] },
  weapon: { level: 90, phase: 6 },
}

/** A level goal raised as far as the talent goals' ascensions need, which talents depend on. */
export function raiseForTalents(stage: Stage, phase: number, caps: readonly number[]): Stage {
  const lowest = stageAt(phase, caps)
  return compareStages(lowest, stage) > 0 ? lowest : stage
}

const higher = (a: Stage, b: Stage) => (compareStages(a, b) >= 0 ? a : b)

/**
 * A new character goal: the default level, or where the character is when
 * past it; each talent at its rank's default when that is above where it is,
 * else not raised (0); then the level raised as far as those talents need.
 * `order` ranks the talents, as `talentOrder` does.
 */
export function characterTarget(
  defaults: Defaults,
  from: CharacterState,
  order: readonly Talent[],
  caps: readonly number[],
): CharacterState {
  const talents: Levels = { auto: 0, skill: 0, burst: 0 }
  let phase = 0
  for (const talent of TALENTS) {
    const level = defaults.character.talents[order.indexOf(talent)] ?? 0
    if (level <= from.talents[talent]) continue
    talents[talent] = level
    phase = Math.max(phase, talentPhase(level))
  }
  const stage = higher(from.stage, defaults.character.stage)
  return { stage: raiseForTalents(stage, phase, caps), talents }
}

/** A new weapon goal: the default level as far as the weapon goes, never below where it is. */
export function weaponTarget(defaults: Defaults, from: Stage, caps: readonly number[]): Stage {
  const top = stages(caps).at(-1) ?? from
  return higher(from, compareStages(defaults.weapon, top) > 0 ? top : defaults.weapon)
}
