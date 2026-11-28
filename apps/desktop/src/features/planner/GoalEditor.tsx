// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { GripVertical } from "lucide-react"
import { useState } from "react"
import { CheckboxField } from "@/components/CheckboxField"
import { Tip } from "@/components/Tip"
import { type Card, type Goal, goalName, isWeaponGoal, talentOrder } from "@/domain/plan"
import {
  compareStages,
  type Stage,
  stages,
  TALENTS,
  type Talent,
  talentCap,
  talentPhase,
} from "@/domain/planner"
import { cn } from "@/lib/cn"
import { moveItem } from "@/lib/dragGeometry"
import { useDragOrder } from "@/lib/useDragOrder"
import { usePlannerStore } from "@/stores/plannerStore"
import { text } from "@/text"
import { Choice } from "./Choice"
import { CustomFields } from "./CustomFields"
import { rankedOrder, stageLabel } from "./GoalCard"
import { RankBadge } from "./RankBadge"

const t = text.planner

type Props = { card: Card | undefined; onClose: () => void }

/** Changes a goal; every pick is saved at once. */
export function GoalEditor({ card, onClose }: Props) {
  const update = (edit: (goal: Goal) => Goal) =>
    usePlannerStore.getState().change(plan => ({
      ...plan,
      goals: plan.goals.map(goal => (goal.id === card?.goal.id ? edit(goal) : goal)),
    }))
  return (
    <AlertDialog isOpen={card !== undefined} onOpenChange={open => open || onClose()}>
      <AlertDialog.Backdrop isDismissable isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className={width(card?.goal)}>
            {card && (
              <>
                <AlertDialog.Header>
                  <AlertDialog.Heading>{goalName(card.goal)}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body className="flex flex-col gap-5 text-[13px]">
                  {(card.goal.kind === "custom" || card.goal.kind === "customWeapon") && (
                    <CustomFields key={card.goal.id} goal={card.goal} update={update} />
                  )}
                  <div
                    className={cn(
                      "grid gap-5",
                      isWeaponGoal(card.goal)
                        ? "grid-cols-[minmax(0,252px)]"
                        : "grid-cols-[200px_1fr]",
                    )}
                  >
                    <StagePicker card={card} update={update} />
                    {isWeaponGoal(card.goal) ? (
                      <div className="flex">
                        <CheckboxField
                          checked={card.goal.expBoost === true}
                          label={t.expBoost}
                          onChange={on =>
                            update(g => (isWeaponGoal(g) ? { ...g, expBoost: on || undefined } : g))
                          }
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <TalentPickers card={card} update={update} />
                        <OrderEditor card={card} update={update} />
                      </div>
                    )}
                  </div>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="primary">
                    {t.done}
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}

/** A weapon has only the level picker; a custom one its fields above it too. */
function width(goal: Goal | undefined) {
  if (goal?.kind === "weapon") return "max-w-[300px]"
  return goal?.kind === "customWeapon" ? "max-w-[640px]" : "max-w-[720px]"
}

export type Update = (edit: (goal: Goal) => Goal) => void
type PartProps = { card: Card; update: Update }

function goalStage(goal: Goal) {
  return isWeaponGoal(goal) ? goal.to : goal.to.stage
}

/** Picks a level as the game's ascension screen lists them: 1, then 20 | 20★ … then 90. */
function StagePicker({ card, update }: PartProps) {
  const { caps, from } = card
  const all = stages(caps)
  const rows: Stage[][] = []
  for (const stage of all) {
    const row = rows.at(-1)
    if (row?.[0]?.level === stage.level) row.push(stage)
    else rows.push([stage])
  }
  const picked = goalStage(card.goal)
  const pick = (stage: Stage) =>
    update(goal => {
      if (isWeaponGoal(goal)) return { ...goal, to: stage }
      // Talents above what the new level allows come down to it.
      const cap = talentCap(stage.phase)
      const talents = { ...goal.to.talents }
      for (const talent of TALENTS) talents[talent] = Math.min(talents[talent], cap)
      return { ...goal, to: { stage, talents } }
    })
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-muted">{t.editLevel}</h4>
      <div className="flex flex-col gap-1.5">
        {rows.map(row => (
          <div
            key={row[0]?.level}
            className={cn("grid gap-1.5", row.length === 2 && "grid-cols-2")}
          >
            {row.map(stage => (
              <Choice
                key={`${stage.level}/${stage.phase}`}
                label={stageLabel(stage, caps)}
                selected={compareStages(stage, picked) === 0}
                disabled={compareStages(stage, from.stage) < 0}
                onPick={() => pick(stage)}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Each talent's goal. Levels past what the level goal's ascensions allow are
 * greyed out: raising them takes a higher level goal first.
 */
function TalentPickers({ card, update }: PartProps) {
  const { goal, from } = card
  if (isWeaponGoal(goal)) return null
  const order = rankedOrder(goal)
  const phase = goal.to.stage.phase
  const pick = (talent: Talent, level: number) =>
    update(g =>
      isWeaponGoal(g)
        ? g
        : { ...g, to: { ...g.to, talents: { ...g.to.talents, [talent]: level } } },
    )
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-muted">{t.editTalents}</h4>
      {TALENTS.map(talent => {
        const now = from.talents[talent]
        const aim = goal.to.talents[talent]
        const bonus = card.bonus[talent]
        return (
          <div key={talent} className="flex items-center gap-1.5">
            <span className="flex w-14 flex-none items-center gap-1">
              {order.includes(talent) && <RankBadge rank={order.indexOf(talent)} />}
              {t.talents[talent]}
            </span>
            <TalentProgress now={now} aim={aim} bonus={bonus} />
            <div className="flex flex-wrap gap-1">
              {LEVELS.map(level =>
                level === now ? (
                  // The current level is the goal of not raising it.
                  <Choice
                    key={level}
                    label={String(level + bonus)}
                    tip={t.keep}
                    selected={aim <= now}
                    onPick={() => pick(talent, 0)}
                    className="w-7"
                  />
                ) : (
                  <Choice
                    key={level}
                    label={String(level + bonus)}
                    tip={level > now ? t.talentNeeds(talentPhase(level)) : undefined}
                    selected={aim === level}
                    disabled={level < now || talentPhase(level) > phase}
                    onPick={() => pick(talent, level)}
                    className="w-7"
                  />
                ),
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}

type ProgressProps = { now: number; aim: number; bonus: number }

/**
 * A talent's level, then "→ goal" when it is raised, as on the cards. The goal
 * fades in and out in a space kept for it, so the picks beside never move; it
 * keeps the last goal while it fades out.
 */
function TalentProgress({ now, aim, bonus }: ProgressProps) {
  const raised = aim > now
  const [shown, setShown] = useState(aim)
  if (raised && shown !== aim) setShown(aim)
  return (
    <span className="tabular w-12 flex-none whitespace-nowrap">
      <span className={bonus > 0 ? "text-(--accent-text)" : "text-muted"}>{now + bonus}</span>
      <span
        aria-hidden={!raised}
        className={cn(
          "transition-[opacity,translate] duration-200 ease-(--ease-out-soft) motion-reduce:transition-none",
          raised ? "opacity-100" : "-translate-x-1 opacity-0",
        )}
      >
        <span className="px-0.5 text-muted">→</span>
        <span className="font-semibold">{shown + bonus}</span>
      </span>
    </span>
  )
}

/**
 * Every talent level, so the picks stay in place: those below the current one
 * greyed out, the current one for not raising it. Each shows the level with
 * the constellations' +3, as the game does, though goals keep the base level.
 */
const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1)

/** The talents' order of importance, dragged into place or moved with the arrow keys. */
function OrderEditor({ card, update }: PartProps) {
  const drag = useDragOrder((from, to) =>
    update(g => (isWeaponGoal(g) ? g : { ...g, order: moveItem(talentOrder(g), from, to) })),
  )
  const { goal } = card
  if (isWeaponGoal(goal)) return null
  // A custom character's talents go unranked, in the game's order, till one is moved.
  const order = talentOrder(goal)
  const ranked = rankedOrder(goal).length > 0
  const reset = () =>
    drag.rearrange(() => update(g => (isWeaponGoal(g) ? g : { ...g, order: undefined })))
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="flex items-baseline gap-2 text-muted">
        {t.editOrder}
        <span className="text-[12px]">{t.editOrderHint}</span>
      </h4>
      <div className="flex flex-wrap items-center gap-2">
        {order.map((talent, at) => {
          const name = t.talents[talent]
          return (
            <Tip key={talent} content={t.dragHint} className="contents">
              <button
                type="button"
                {...drag.item(at)}
                {...drag.handle(at)}
                aria-label={t.dragLabel(ranked ? t.rankedName(name, at + 1) : name)}
                className="flex items-center gap-1 rounded-[8px] border border-border bg-overlay py-1 pr-2.5 pl-1.5 transition-colors duration-150 hover:border-(--field-border) focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                <GripVertical aria-hidden size={13} className="text-muted" />
                {ranked && <RankBadge rank={at} />}
                {name}
              </button>
            </Tip>
          )
        })}
        {goal.order && (
          <button
            type="button"
            data-rise
            onClick={reset}
            className="cursor-pointer text-(--accent-text) hover:underline"
          >
            {t.resetOrder}
          </button>
        )}
      </div>
    </section>
  )
}
