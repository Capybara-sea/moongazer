// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Changes to a plan past a goal's own targets: moving a goal, switching it
 * off, and turning a custom goal into the released character's or weapon's.
 */

import type { Account } from "@/domain/account"
import { weaponData } from "@/domain/names"
import { type Goal, type Plan, type WeaponPick, weaponPlanned } from "@/domain/plan"
import { compareStages, isPlannable, stages, weaponCaps } from "@/domain/planner"

/** The plan with the goal at `from` moved to `to`; as it was when either is out of range. */
export function moveGoal(plan: Plan, from: number, to: number): Plan {
  const goal = plan.goals[from]
  if (goal === undefined || from === to || to < 0 || to >= plan.goals.length) return plan
  return { ...plan, goals: plan.goals.toSpliced(from, 1).toSpliced(to, 0, goal) }
}

/** The plan with a goal switched off, or back on. */
export function setGoalOff(plan: Plan, id: string, off: boolean): Plan {
  const goals = plan.goals.map(
    (goal): Goal => (goal.id === id ? { ...goal, off: off || undefined } : goal),
  )
  return { ...plan, goals }
}

/**
 * A custom goal turned into the released character's, its targets and talent
 * order kept; the plan as it was when that character is planned already.
 */
export function replaceCustom(plan: Plan, goalId: string, key: string): Plan {
  const planned = plan.goals.some(g => g.kind === "character" && g.key === key)
  if (planned || !isPlannable("character", key)) return plan
  const goals = plan.goals.map(
    (goal): Goal =>
      goal.kind === "custom" && goal.id === goalId
        ? { id: goal.id, off: goal.off, kind: "character", key, to: goal.to, order: goal.order }
        : goal,
  )
  return { ...plan, goals }
}

/**
 * A custom weapon goal turned into a released weapon's, its level goal kept
 * as far as that weapon goes, and whether it is off or its EXP boosted; the
 * plan as it was when that weapon is planned already.
 */
export function replaceCustomWeapon(
  plan: Plan,
  goalId: string,
  pick: WeaponPick,
  account: Account,
): Plan {
  if (!isPlannable("weapon", pick.key) || weaponPlanned(plan, account, pick)) return plan
  const top = stages(weaponCaps(weaponData(pick.key).rarity ?? 5)).at(-1)
  const { key, guid, wielder, copy } = pick
  const goals = plan.goals.map((goal): Goal => {
    if (goal.kind !== "customWeapon" || goal.id !== goalId) return goal
    const to = top && compareStages(goal.to, top) > 0 ? top : goal.to
    const { id, off, expBoost } = goal
    return { id, off, kind: "weapon", key, guid, wielder, copy, to, expBoost }
  })
  return { ...plan, goals }
}
