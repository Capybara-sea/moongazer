// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ArrowRight, Plus } from "lucide-react"
import { type ReactNode, useMemo } from "react"
import { GameIcon } from "@/components/GameIcon"
import { iconTone } from "@/components/RarityChip"
import { useTip } from "@/components/Tip"
import { isConvertCost } from "@/domain/convert"
import { unknownSlot } from "@/domain/customCharacter"
import { materialData } from "@/domain/names"
import { knownLike } from "@/domain/plan"
import {
  type CombineStep,
  type Conversion,
  combineSteps,
  expUnit,
  isExp,
  type Line,
  plannerBag,
  WEAPON_EXP,
} from "@/domain/planner"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { formatAmount } from "@/lib/format"
import { useCurrentAccount } from "@/stores/accountStore"

const t = text.planner
/** How many goals a material's tip names before it only counts them. */
const NAMED = 8

/**
 * A line's material as shown: EXP as its best item's count; needs round up,
 * what there is rounds down. A custom character's or weapon's material not
 * known yet goes by its slot.
 */
export function lineView(key: string) {
  const unit = expUnit(key)
  const unknown = unknownSlot(key)
  const data = materialData(unit?.item ?? key)
  /** `value` in whole items, EXP as its best item's. */
  const whole = (value: number, up: boolean) => {
    const items = value / (unit?.exp ?? 1)
    return up ? Math.ceil(items) : Math.floor(items)
  }
  const count = (value: number, up: boolean) => formatAmount(whole(value, up), up ? "up" : "down")
  return {
    ...data,
    name: unknown
      ? t.unknownSlot(unknown.of === "weapon" ? t.weaponSlots[unknown.slot] : t.slots[unknown.slot])
      : data.name,
    // Not known yet, yet its slot and tier tell its rarity.
    rarity: unknown ? materialData(knownLike(key)).rarity : data.rarity,
    unknown: unknown !== undefined,
    whole,
    count,
  }
}

type IconProps = { view: ReturnType<typeof lineView>; className: string }

/** A material's icon in its rarity's color; "?" for one not known yet. */
export function MaterialIcon({ view, className }: IconProps) {
  return (
    <GameIcon
      icon={view.icon}
      label={view.name}
      placeholder={view.unknown ? "?" : undefined}
      className={cn(className, iconTone(view.rarity))}
    />
  )
}

/**
 * What a cell writes under its icon: what is still short, or what is needed once there is
 * enough or while the material is not known yet; for what conversions are paid in, what they
 * spend.
 */
export function cellLabel(key: string, have: number, need: number) {
  const view = lineView(key)
  if (view.unknown || isConvertCost(key) || have >= need) return view.count(need, true)
  return t.short(view.count(need - have, true))
}

/**
 * Whether a cell has all it needs and fades into the background: a known material with enough.
 * What conversions are paid in always has, as they spend only what there is.
 */
export function isMet(key: string, have: number, need: number) {
  return !lineView(key).unknown && have >= need
}

/** What `materials` hold of `key` before the cards share them, EXP as the planner pools it. */
export function bagHolds(materials: ReadonlyMap<string, number>, key: string) {
  return (isExp(key) ? plannerBag(materials) : materials).get(key) ?? 0
}

/** What the shown account's bag holds of `key`; nothing while there is no account to read. */
export function useBagHolds(key: string) {
  const { account } = useCurrentAccount()
  return useMemo(() => account && bagHolds(account.materials, key), [account, key])
}

/**
 * A cell's tip on its amount: "x/y" to go beside the name, x what there is of it for the cell
 * before combining and converting (`held`), y what it needs; "—" for x while it is not known.
 * Then, for what conversions are paid in, what they spend, and for EXP, that it counts every
 * book or ore by its EXP; and, given what the bag holds (`bag`), the bag, with what the cards
 * before took of it when they took some. What there is rounds down, but once it is enough as
 * the need does, so it never reads as less; the bag rounds as x does, and what went is the
 * difference of the two as written.
 */
export function amountTip(
  key: string,
  held: number | undefined,
  need: number,
  bag?: number,
): { amount: string; lines: (string | undefined)[] } {
  const view = lineView(key)
  const enough = held !== undefined && held >= need
  const x = held === undefined || view.unknown ? "—" : view.count(held, enough)
  const bagged = bag === undefined ? 0 : view.whole(bag, enough)
  const gone = held === undefined || view.unknown ? 0 : bagged - view.whole(held, enough)
  const written = formatAmount(bagged, enough ? "up" : "down")
  const shared =
    bag === undefined || view.unknown
      ? undefined
      : gone >= 1
        ? t.sharedBag(written, formatAmount(gone), key === "Mora")
        : t.inBag(written, key === "Mora")
  const about = isConvertCost(key)
    ? t.convertSpend(view.count(need, true))
    : isExp(key)
      ? t.expEquivalent[key === WEAPON_EXP ? "weapon" : "character"]
      : undefined
  return { amount: `${x}/${view.count(need, true)}`, lines: [about, shared] }
}

type Amount = readonly [key: string, count: number]
/** What goes in, what converting is paid in among it, and what comes out. */
export type Recipe = { kind: "combine" | "convert"; inputs: Amount[]; output: Amount }

/**
 * How combining and converting made up a material: the steps of combining, the lowest tier
 * first, and what converting made; a card's, or every card's added up.
 */
export type MadeUp = { key: string; steps: readonly CombineStep[]; converted?: Conversion }

/** What combining and converting did for a card's line. */
export function lineMadeUp(line: Line): MadeUp {
  return { key: line.key, steps: combineSteps(line), converted: line.converted }
}

/**
 * What combining and converting do for what is short, whether or not it is then enough: a
 * recipe for each step of combining, the lowest tier first, without its Mora, then one for
 * converting; nothing when neither does anything.
 */
export function recipes({ key, steps, converted }: MadeUp): Recipe[] | undefined {
  if (steps.length === 0 && !converted) return undefined
  const combined = steps.map(
    (step): Recipe => ({
      kind: "combine",
      inputs: [[step.from, step.count]],
      output: [step.to, step.made],
    }),
  )
  if (!converted) return combined
  const convert: Recipe = {
    kind: "convert",
    inputs: [...converted.from, [converted.cost, converted.paid]],
    output: [key, converted.count],
  }
  return [...combined, convert]
}

/** An amount as an icon and its count. */
function RecipeAmount({ amount: [key, count] }: { amount: Amount }) {
  return (
    <span className="inline-flex items-center gap-1">
      <MaterialIcon view={lineView(key)} className="size-7 rounded-[7px] text-[12px]" />
      <span className="tabular">{t.times(formatAmount(count, "up"))}</span>
    </span>
  )
}

const JOIN = <Plus aria-hidden className="size-3 flex-none text-muted" />
const ARROW = <ArrowRight aria-hidden className="size-3.5 flex-none text-muted" />

/**
 * What `recipes` gives, a line each: "combine  [icon] ×21 → [icon] ×7", then one line of `bag`,
 * what the bag holds, if given, and what is still needed after them. A line too long for the tip
 * wraps before a "+" or the arrow, never after, and goes on past its label.
 */
export function recipeNote(item: MadeUp & { need: number; have: number }, bag?: string) {
  const list = recipes(item)
  if (!list) return undefined
  const view = lineView(item.key)
  const by = [...new Set(list.map(recipe => t.recipeKinds[recipe.kind]))].join(t.listSeparator)
  const left = item.need - item.have
  return (
    <>
      <span className="flex flex-col gap-1.5">
        {list.map(recipe => (
          <span
            key={`${recipe.kind}-${recipe.output[0]}`}
            className="grid grid-cols-[auto_1fr] items-start gap-x-2"
          >
            <span className="text-muted leading-7">{t.recipeKinds[recipe.kind]}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {recipe.inputs.map((amount, index) => (
                <span key={amount[0]} className="inline-flex items-center gap-1.5">
                  {index > 0 && JOIN}
                  <RecipeAmount amount={amount} />
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                {ARROW}
                <RecipeAmount amount={recipe.output} />
              </span>
            </span>
          </span>
        ))}
      </span>
      <span>
        {[bag, t.afterRecipes(by, left > 0 ? view.count(left, true) : undefined)]
          .filter(Boolean)
          .join(t.clauseSeparator)}
      </span>
    </>
  )
}

/** The goals that need a material, the first few by name; nothing when none do. */
export function neededBy(goals: readonly string[]) {
  return goals.length === 0 ? undefined : t.neededBy(goals.slice(0, NAMED), goals.length)
}

/**
 * A material's tip: its name with `amount` beside it, then each of `lines` given, then `recipe`,
 * then the goals that need it.
 */
export function materialTip(
  name: string,
  amount: string,
  lines: readonly (string | undefined)[],
  goals: readonly string[],
  recipe?: ReactNode,
) {
  const who = neededBy(goals)
  return (
    <>
      <span>
        <span className="font-semibold">{name}</span>
        <span className="tabular">{t.besideName(amount)}</span>
      </span>
      {lines.map(line => line && <span key={line}>{line}</span>)}
      {recipe}
      {who && <span className="text-muted">{who}</span>}
    </>
  )
}

/** The "combined" or "converted" mark on a cell's icon, at its top right. */
export function Mark({ children }: { children: string }) {
  return (
    <span className="absolute -top-1.5 -right-1.5 rounded-[5px] bg-(--warn) px-1 font-semibold text-[10px] text-(--on-warn) leading-[16px] shadow-[0_0_0_2px_var(--surface)]">
      {children}
    </span>
  )
}

type CellProps = {
  line: Line
  /** The names of the goals that need it, the card's own among them. */
  goals: readonly string[]
  note?: string
}

/**
 * A material a card needs: its icon over what is still short, red, or what is
 * needed, muted and faded, once there is enough; amber with a "combined" mark when
 * combining three of the tier below makes up the rest, or a "converted" mark when
 * converting others of the same tier does; muted, with what is needed, when not known
 * yet; muted and faded, with what they spend, for what conversions are paid in.
 * Every cell is as wide as the next, so a long count is cut short rather than
 * pushing them apart; the tip, the same all over the cell, has what there is for
 * the card of what it needs, and how combining and converting make it up.
 */
export function MaterialCell({ line, goals, note }: CellProps) {
  const view = lineView(line.key)
  const bag = useBagHolds(line.key)
  const short = !view.unknown && line.have < line.need
  const mark = !short && (line.converted ? t.convertMark : line.made > 0 && t.combineMark)
  const met = !mark && isMet(line.key, line.have, line.need)
  const {
    amount,
    lines: [about, held],
  } = amountTip(line.key, line.bag, line.need, bag)
  // With recipes, the bag goes on their last line, with what is still needed.
  const recipe = recipeNote({ ...lineMadeUp(line), need: line.need, have: line.have }, held)
  const tip = useTip<HTMLLIElement>(
    materialTip(view.name, amount, [about, recipe ? undefined : held, note], goals, recipe),
  )
  return (
    <li {...tip.props} className="flex w-[52px] flex-col items-center gap-1">
      <span className={cn("relative", met && "opacity-40")}>
        <MaterialIcon view={view} className="size-12 rounded-[11px] text-[17px]" />
        {mark && <Mark>{mark}</Mark>}
      </span>
      <span
        className={cn(
          "tabular max-w-full truncate text-[11px] leading-none",
          short ? "text-(--err)" : mark ? "text-(--warn)" : "text-muted",
          met && "opacity-70",
        )}
      >
        {cellLabel(line.key, line.have, line.need)}
      </span>
      {tip.bubble}
    </li>
  )
}
