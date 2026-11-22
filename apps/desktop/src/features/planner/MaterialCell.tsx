// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { GameIcon } from "@/components/GameIcon"
import { iconTone } from "@/components/RarityChip"
import { useTip } from "@/components/Tip"
import { unknownSlot } from "@/domain/customCharacter"
import { materialData } from "@/domain/names"
import { knownLike } from "@/domain/plan"
import { expUnit, type Line } from "@/domain/planner"
import { cn } from "@/lib/cn"
import { formatAmount } from "@/lib/format"
import { text } from "@/text/zh"

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
  const count = (value: number, up: boolean) => {
    const items = value / (unit?.exp ?? 1)
    return formatAmount(up ? Math.ceil(items) : Math.floor(items), up ? "up" : "down")
  }
  return {
    ...data,
    name: unknown
      ? t.unknownSlot(unknown.of === "weapon" ? t.weaponSlots[unknown.slot] : t.slots[unknown.slot])
      : data.name,
    // Not known yet, yet its slot and tier tell its rarity.
    rarity: unknown ? materialData(knownLike(key)).rarity : data.rarity,
    unknown: unknown !== undefined,
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
 * "have/need"; "—" for what there is of a material not known yet. Enough
 * rounds as the need does, so it never reads as less.
 */
export function haveOfNeed(key: string, have: number, need: number) {
  const view = lineView(key)
  const written = view.unknown ? "—" : view.count(have, have >= need)
  return `${written}/${view.count(need, true)}`
}

/**
 * What a cell writes under its icon: what is still short, or that it is enough; for a
 * material not known yet, what is needed.
 */
export function shortOf(key: string, have: number, need: number) {
  const view = lineView(key)
  if (view.unknown) return view.count(need, true)
  return have < need ? view.count(need - have, true) : t.satisfied
}

/** A cell's tip on its amount: "have/need", then what is short or that it is enough. */
export function amountLines(key: string, have: number, need: number) {
  const view = lineView(key)
  const status = have < need ? t.stillShort(view.count(need - have, true)) : t.satisfied
  return [haveOfNeed(key, have, need), view.unknown ? undefined : status]
}

/** What combining takes, when it makes up what the card is short; nothing otherwise. */
export function combinedNote(line: Line) {
  const view = lineView(line.key)
  if (line.made === 0 || line.have < line.need) return undefined
  const used = [...line.used]
    .map(([key, count]) => {
      const amount = formatAmount(count, "up")
      return key === "Mora" ? t.usedMora(amount) : t.usedItem(amount, materialData(key).name)
    })
    .join(t.listSeparator)
  return t.combined(view.count(line.bag, false), formatAmount(line.made), used)
}

/** The goals that need a material, the first few by name; nothing when none do. */
export function neededBy(goals: readonly string[]) {
  return goals.length === 0 ? undefined : t.neededBy(goals.slice(0, NAMED), goals.length)
}

/** A material's tip: its name, then each of `lines` given, then the goals that need it. */
export function materialTip(
  name: string,
  lines: readonly (string | undefined)[],
  goals: readonly string[],
) {
  const who = neededBy(goals)
  return (
    <>
      <span className="font-semibold">{name}</span>
      {lines.map(line => line && <span key={line}>{line}</span>)}
      {who && <span className="text-muted">{who}</span>}
    </>
  )
}

type CellProps = {
  line: Line
  /** The names of the goals that need it, the card's own among them. */
  goals: readonly string[]
  note?: string
}

/**
 * A material a card needs: its icon over what is still short, red, or
 * that it is enough; amber with a "combined" mark when combining three of the tier
 * below makes up the rest; muted, with what is needed, when not known yet.
 * Every cell is as wide as the next, so a long count is cut short rather than
 * pushing them apart; the tip, the same all over the cell, has "have/need".
 */
export function MaterialCell({ line, goals, note }: CellProps) {
  const view = lineView(line.key)
  const short = !view.unknown && line.have < line.need
  const tip = useTip<HTMLLIElement>(
    materialTip(
      view.name,
      [...amountLines(line.key, line.have, line.need), combinedNote(line), note],
      goals,
    ),
  )
  return (
    <li {...tip.props} className="flex w-[54px] flex-col items-center gap-1">
      <span className="relative">
        <MaterialIcon view={view} className="size-10 rounded-[10px] text-[15px]" />
        {line.made > 0 && !short && (
          <span className="absolute -top-1.5 -right-1.5 rounded-[5px] bg-warning px-1 font-semibold text-[10px] text-warning-foreground leading-[16px]">
            {t.combineMark}
          </span>
        )}
      </span>
      <span
        className={cn(
          "tabular max-w-full truncate text-[11px] leading-none",
          short ? "text-danger" : line.made > 0 ? "text-warning" : "text-muted",
        )}
      >
        {shortOf(line.key, line.have, line.need)}
      </span>
      {tip.bubble}
    </li>
  )
}
