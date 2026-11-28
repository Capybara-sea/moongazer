// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ArrowRight, ChevronRight, Plus } from "lucide-react"
import { GameIcon } from "@/components/GameIcon"
import { Panel } from "@/components/Panel"
import { iconTone } from "@/components/RarityChip"
import { characterData, weaponData } from "@/domain/names"
import { type Card, type Goal, goalName } from "@/domain/plan"
import { type Amount, type Recipe, type UpgradeRow, upgradeRows } from "@/domain/today"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { formatAmount } from "@/lib/format"
import { navigate } from "@/lib/route"
import { lineView, MaterialIcon } from "./MaterialCell"
import { targetText } from "./upgradeText"

const u = text.upgrade

/** Up to five goals whose next step has its materials; each jumps to its card. */
export function UpgradePanel({ cards }: { cards: readonly Card[] }) {
  const rows = upgradeRows(cards)
  return (
    <Panel aria-label={u.title}>
      <h2 className="font-semibold text-[15px]">{u.title}</h2>
      {rows.length === 0 ? (
        <p className="text-[12px] text-muted">{u.none}</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {rows.map(row => (
            <Upgrade key={row.card.goal.id} row={row} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

/**
 * A goal's next step: its portrait, its name, the step from where it starts in the accent
 * colour, and under them what must be combined or converted first, a line each.
 */
function Upgrade({ row }: { row: UpgradeRow }) {
  const { goal } = row.card
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate("planner", goal.id)}
        className="flex w-full cursor-pointer items-start gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-default/40 motion-reduce:transition-none"
      >
        {/* The name follows; the portrait would say it twice. */}
        <span aria-hidden className="contents">
          <Avatar goal={goal} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[13px]">{goalName(goal)}</span>
          <span className="tabular font-semibold text-(--accent-text) text-[12px]">
            {targetText(row.target)}
          </span>
          {row.recipes.length > 0 && (
            <span className="mt-1 flex flex-col gap-1">
              {row.recipes.map(recipe => (
                <RecipeLine key={`${recipe.kind}-${recipe.output[0]}`} recipe={recipe} />
              ))}
            </span>
          )}
        </span>
        <ChevronRight aria-hidden className="mt-2.5 size-4 flex-none text-muted" />
      </button>
    </li>
  )
}

/** "combine  [icon] ×9 → [icon] ×3", wrapping before a "+" or the arrow. */
function RecipeLine({ recipe }: { recipe: Recipe }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
      <span className="text-muted">{u.recipeKinds[recipe.kind]}</span>
      {recipe.inputs.map((amount, index) => (
        <span key={amount[0]} className="inline-flex items-center gap-1.5">
          {index > 0 && (
            <>
              <Plus aria-hidden className="size-3 flex-none text-muted" />
              <span className="sr-only">{u.and}</span>
            </>
          )}
          <RecipeAmount amount={amount} />
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <ArrowRight aria-hidden className="size-3.5 flex-none text-muted" />
        <span className="sr-only">{u.makes}</span>
        <RecipeAmount amount={recipe.output} />
      </span>
    </span>
  )
}

/** A material's icon and how many, the name for screen readers and on hover. */
function RecipeAmount({ amount: [key, count] }: { amount: Amount }) {
  const view = lineView(key)
  return (
    <span className="inline-flex items-center gap-1">
      <MaterialIcon view={view} className="size-6 rounded-[6px] text-[11px]" />
      <span className="tabular">{u.times(formatAmount(count, "up"))}</span>
    </span>
  )
}

function Avatar({ goal }: { goal: Goal }) {
  const custom = goal.kind === "custom" || goal.kind === "customWeapon"
  const data = custom
    ? { icon: undefined, name: goal.name, rarity: goal.rarity }
    : goal.kind === "weapon"
      ? weaponData(goal.key)
      : characterData(goal.key)
  return (
    <GameIcon
      icon={data.icon}
      label={data.name}
      placeholder={custom ? "?" : undefined}
      className={cn("size-9 flex-none rounded-[10px] text-[14px]", iconTone(data.rarity))}
    />
  )
}
