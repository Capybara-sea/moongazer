// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button, Popover } from "@heroui/react"
import { GripVertical, Trash2 } from "lucide-react"
import { GameIcon } from "@/components/GameIcon"
import { Switch } from "@/components/Switch"
import { Tip } from "@/components/Tip"
import { characterData, lookup } from "@/domain/names"
import { type Card, goalName, type Plan } from "@/domain/plan"
import { setGoalOff } from "@/domain/planEdits"
import { cn } from "@/lib/cn"
import type { DragHandleProps, DragItemProps } from "@/lib/useDragOrder"
import { usePlannerStore } from "@/stores/plannerStore"
import { text } from "@/text/zh"

const t = text.planner

/** What a card switched off fades; its controls stay as they are, to switch it back on. */
export function dimmed(off: boolean) {
  return cn(
    "transition-opacity duration-200 ease-(--ease-out-soft) motion-reduce:transition-none",
    off && "opacity-45",
  )
}

/** A card's part in reordering the list (useDragOrder); none while it is the only one. */
export type CardDrag = {
  item: DragItemProps
  handle: DragHandleProps
  rearrange: (change: () => void) => void
}

type Props = { card: Card; drag: CardDrag | undefined; onReplace: () => void }

/**
 * A card's first row: a grip to move it by, name, tag and wielder, then
 * switching the goal off and deleting it.
 */
export function GoalHeader({ card, drag, onReplace }: Props) {
  const { goal, standing, wielder, off } = card
  const tag = standing === "owned" ? undefined : t.tags[standing]
  const holder = wielder ? characterData(wielder) : undefined
  const name = goalName(goal)
  // Switching off or deleting changes the card's size or takes it out, so the others slide.
  const edit = (change: (plan: Plan) => Plan) => {
    const save = () => usePlannerStore.getState().change(change)
    if (drag) drag.rearrange(save)
    else save()
  }
  return (
    <div className="flex items-center gap-2">
      {drag && (
        <Tip content={t.priorityHint} className="contents">
          <button
            type="button"
            {...drag.handle}
            aria-label={t.dragLabel(name)}
            aria-description={t.priorityHint}
            className="-ml-1.5 flex h-7 w-5 flex-none cursor-grab items-center justify-center rounded-[6px] text-muted transition-colors duration-150 hover:bg-default/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            <GripVertical aria-hidden size={15} />
          </button>
        </Tip>
      )}
      <div className={cn("flex min-w-0 flex-1 items-center gap-2", dimmed(off))}>
        <h3 className="truncate font-semibold text-[15px]">{name}</h3>
        {tag && (
          <Tip
            content={standing === "otherElement" ? t.otherElementTip : undefined}
            className="flex-none rounded-[6px] bg-default/60 px-1.5 text-[11px] text-muted leading-[18px]"
          >
            {tag}
          </Tip>
        )}
        {holder && (
          <GameIcon
            icon={holder.icon}
            label={t.wielder(
              wielder === "Traveler" ? lookup("characters", "Traveler").name : holder.name,
            )}
            className="size-6 flex-none rounded-full bg-surface-secondary text-[11px]"
          />
        )}
      </div>
      {(goal.kind === "custom" || goal.kind === "customWeapon") && (
        <button
          type="button"
          onClick={onReplace}
          className="flex-none cursor-pointer whitespace-nowrap text-(--accent-text) text-[12px] hover:underline"
        >
          {t.replace[goal.kind === "custom" ? "character" : "weapon"]}
        </button>
      )}
      <span aria-hidden className="flex-none text-[12px] text-muted">
        {t.off}
      </span>
      <Switch
        checked={off}
        label={t.offLabel(name)}
        onChange={on => edit(plan => setGoalOff(plan, goal.id, on))}
      />
      <RemoveGoal
        name={name}
        onRemove={() =>
          edit(plan => ({ ...plan, goals: plan.goals.filter(other => other.id !== goal.id) }))
        }
      />
    </div>
  )
}

/** Deleting a goal cannot be undone, so it asks once more beside the button. */
function RemoveGoal({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <Popover>
      <Button
        variant="ghost"
        isIconOnly
        aria-label={t.removeLabel(name)}
        className="size-7 min-w-0 flex-none rounded-[8px] text-muted hover:text-danger"
      >
        <Trash2 aria-hidden size={15} />
      </Button>
      <Popover.Content
        placement="bottom end"
        offset={6}
        className="glass w-[236px] rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
      >
        <Popover.Dialog
          aria-label={t.remove}
          className="flex flex-col gap-3 p-3.5 text-[13px] outline-none"
        >
          <p>{t.removeAsk}</p>
          <div className="flex justify-end gap-2">
            <Button slot="close" variant="tertiary" size="sm">
              {t.cancel}
            </Button>
            <Button variant="danger" size="sm" onPress={onRemove}>
              {t.removeYes}
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
