// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Changes to a plan past a goal's own targets: moving a goal or a summary
 * group, switching a goal off, and turning a custom goal into the released
 * character's or weapon's.
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

/**
 * The plan with the summary group at `from` of those `shown` moved to `to`.
 * Every group shown keeps its new place; a group moved before and not shown
 * now goes right after the one it came after, or first when it came first.
 * As it was when either is out of range.
 */
export function moveSummaryGroup(
  plan: Plan,
  shown: readonly string[],
  from: number,
  to: number,
): Plan {
  const id = shown[from]
  if (id === undefined || from === to || to < 0 || to >= shown.length) return plan
  const order = shown.toSpliced(from, 1).toSpliced(to, 0, id)
  const saved = plan.summaryOrder ?? []
  for (const [at, group] of saved.entries()) {
    if (shown.includes(group)) continue
    const before = saved[at - 1]
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, group)
  }
  return { ...plan, summaryOrder: order }
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
