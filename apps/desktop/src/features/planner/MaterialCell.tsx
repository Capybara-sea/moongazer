// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { GameIcon } from "@/components/GameIcon"
import { RARITY_TONES } from "@/components/RarityChip"
import { unknownSlot } from "@/domain/customCharacter"
import { materialData } from "@/domain/names"
import { expUnit, type Line } from "@/domain/planner"
import { cn } from "@/lib/cn"
import { formatNumber } from "@/lib/format"
import { text } from "@/text/zh"

const t = text.planner

/**
 * A line's material as shown: EXP as its best item's count and Mora from
 * 10,000 up in units of 10,000, both only about right; needs round up, what
 * there is rounds down. A custom character's or weapon's material not known
 * yet goes by its slot.
 */
export function lineView(key: string) {
  const unit = expUnit(key)
  const unknown = unknownSlot(key)
  const data = materialData(unit?.item ?? key)
  const count = (value: number, up: boolean) => {
    const tens = key === "Mora" && value >= 10_000
    const per = tens ? 10_000 : (unit?.exp ?? 1)
    const n = formatNumber(up ? Math.ceil(value / per) : Math.floor(value / per))
    return tens ? t.tenThousand(n) : n
  }
  return {
    ...data,
    name: unknown
      ? t.unknownSlot(unknown.of === "weapon" ? t.weaponSlots[unknown.slot] : t.slots[unknown.slot])
      : data.name,
    unknown: unknown !== undefined,
    approximate: unit !== undefined || key === "Mora",
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
      className={cn(className, RARITY_TONES[view.rarity ?? 0] ?? "bg-surface-secondary")}
    />
  )
}

/** A cell's "have/need"; "—" for what there is of a material not known yet. */
export function cellAmount(line: Line) {
  const view = lineView(line.key)
  const have = view.unknown ? "—" : view.count(line.have, false)
  return `${view.approximate ? t.about : ""}${have}/${view.count(line.need, true)}`
}

/**
 * A cell's tooltip: the name and the whole of "have/need", which the cell may
 * cut short; then what combining takes when it makes up what is short, and the
 * card's own `note` last.
 */
export function cellTitle(line: Line, note?: string) {
  const view = lineView(line.key)
  const short = !view.unknown && line.have < line.need
  const used = [...line.used]
    .map(([key, count]) =>
      key === "Mora" ? t.usedMora(count) : t.usedItem(count, materialData(key).name),
    )
    .join(t.listSeparator)
  return [
    `${view.name} ${cellAmount(line)}`,
    line.made > 0 && !short ? t.combined(view.count(line.bag, false), line.made, used) : undefined,
    view.approximate ? t.approximate : undefined,
    note,
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * A material a card needs: its icon over "have/need". Red when short; amber
 * with a "combined" mark when combining three of the tier below makes up the
 * rest; muted with no count of its own when not known yet. Every cell is as
 * wide as the next, so a long count is cut short rather than pushing them apart.
 */
export function MaterialCell({ line, note }: { line: Line; note?: string }) {
  const view = lineView(line.key)
  const short = !view.unknown && line.have < line.need
  return (
    <li title={cellTitle(line, note)} className="flex w-[54px] flex-col items-center gap-1">
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
        {cellAmount(line)}
      </span>
    </li>
  )
}
