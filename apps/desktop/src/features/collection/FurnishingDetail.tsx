// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { DoneBadge } from "@/components/DoneBadge"
import { GameIcon } from "@/components/GameIcon"
import { iconTone } from "@/components/RarityChip"
import type { NeedRow, SetRow, UnitRow } from "@/domain/furnishing"
import { lookup } from "@/domain/names"
import { cn } from "@/lib/cn"
import { formatNumber } from "@/lib/format"
import { text } from "@/text/zh"

const t = text.furnishingPage

/**
 * An opened set: each furnishing with what the bag holds and how it is come by, then what making
 * the lacking ones costs against the bag (the whole set's without the bag's counts).
 */
export function SetDetail({ row, bag }: { row: SetRow; bag: boolean }) {
  return (
    <div className="flex flex-col gap-3 px-2.5 pt-1 pb-3.5">
      <UnitTable caption={t.units} units={row.units} bag={bag} />
      <Materials row={row} bag={bag} />
    </div>
  )
}

type TableProps = {
  caption: string
  units: (UnitRow | NeedRow)[]
  bag: boolean
  /** Adds a column of the sets each furnishing is for. */
  usedBy?: boolean
}

/** Furnishings with what is needed, what the bag holds and lacks, and how each is come by. */
export function UnitTable({ caption, units, bag, usedBy = false }: TableProps) {
  return (
    <table className="w-full text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead className="text-left text-[12px] text-muted">
        <tr>
          <th className="py-1 font-normal">{t.columns.item}</th>
          <th className="w-14 py-1 text-right font-normal">{t.columns.need}</th>
          {bag && <th className="w-14 py-1 text-right font-normal">{t.columns.have}</th>}
          {bag && <th className="w-14 py-1 text-right font-normal">{t.columns.short}</th>}
          <th className={cn("py-1 pl-4 font-normal", usedBy ? "w-[32%]" : "w-[44%]")}>
            {t.columns.getting}
          </th>
          {usedBy && <th className="w-[22%] py-1 pl-4 font-normal">{t.columns.usedBy}</th>}
        </tr>
      </thead>
      <tbody>
        {units.map(unit => (
          <Unit key={unit.id} unit={unit} bag={bag} usedBy={usedBy} />
        ))}
      </tbody>
    </table>
  )
}

function Unit({ unit, bag, usedBy }: { unit: UnitRow | NeedRow; bag: boolean; usedBy: boolean }) {
  const short = unit.short ?? 0
  return (
    <tr className={cn("border-border border-t", bag && short === 0 && "text-muted")}>
      <td className="py-1.5">
        <span className="flex items-center gap-2">
          <GameIcon
            icon={unit.info.icon}
            label={unit.info.name}
            className={cn("size-8 rounded-[7px]", iconTone(unit.info.rarity))}
          />
          <span className="min-w-0 truncate">{unit.info.name}</span>
        </span>
      </td>
      <td className="text-right tabular">{formatNumber(unit.need)}</td>
      {bag && <td className="text-right tabular">{formatNumber(unit.have ?? 0)}</td>}
      {bag && (
        <td className={cn("text-right tabular", short > 0 && "text-(--err)")}>
          {short > 0 ? formatNumber(short) : <DoneBadge inline label={t.complete} />}
        </td>
      )}
      <td className="py-1.5 pl-4">
        <span className="flex flex-col">
          <span className={cn(unit.getting === "blueprint" && "text-(--warn)")}>
            {t.getting[unit.getting]}
          </span>
          <span className="text-[12px] text-muted">
            {unit.getting === "buy" ? t.sources(unit.info.source ?? []) : recipeText(unit)}
          </span>
        </span>
      </td>
      {usedBy && "sets" in unit && (
        <td className="py-1.5 pl-4 text-[12px] text-muted">{t.usedBy(unit.sets)}</td>
      )}
    </tr>
  )
}

function recipeText(unit: UnitRow) {
  const parts = Object.entries(unit.info.recipe ?? {}).map(
    ([key, count]) => `${lookup("materials", key).name} ×${formatNumber(count)}`,
  )
  return parts.length > 0 ? t.recipe(parts) : undefined
}

function Materials({ row, bag }: { row: SetRow; bag: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-semibold text-[13px]">{bag ? t.materials : t.materialsWhole}</span>
      {row.materials.length === 0 ? (
        <span className="text-[12px] text-muted">{t.noMaterials}</span>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {row.materials.map(m => {
            const { name, icon } = lookup("materials", m.key)
            const lacking = m.need - m.have
            return (
              <li
                key={m.key}
                className="flex items-center gap-2 rounded-[10px] bg-surface-secondary py-1 pr-2.5 pl-1"
              >
                <GameIcon
                  icon={icon}
                  label={name}
                  className={cn("size-7 rounded-[6px]", iconTone(1))}
                />
                <span className="flex flex-col text-[12px] leading-tight">
                  <span>{name}</span>
                  <span className="tabular">
                    {formatNumber(m.have)} / {formatNumber(m.need)}{" "}
                    {lacking > 0 ? (
                      <span className="text-(--err)">{t.materialShort(lacking)}</span>
                    ) : (
                      <DoneBadge inline />
                    )}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
