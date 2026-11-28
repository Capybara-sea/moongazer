// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Lock } from "lucide-react"
import { GameIcon } from "@/components/GameIcon"
import { iconTone } from "@/components/RarityChip"
import { WeaponTooltip } from "@/components/WeaponTooltip"
import { levelCap } from "@/domain/builds"
import { cn } from "@/lib/cn"
import { text } from "@/text"
import type { WeaponRow } from "./order"

const t = text.weapons
const COLUMNS = ["name", "type", "rarity", "level", "refinement", "wielder", "lock"] as const
const GRID = "grid grid-cols-[minmax(200px,2fr)_96px_56px_96px_64px_minmax(110px,1.2fr)_40px] gap-3"

/** The rarity column's text in the colors of RARITY_TONES. */
const RARITY_TEXT: Record<number, string> = {
  5: "text-(--gold-fg)",
  4: "text-(--purple-fg)",
  3: "text-(--accent-text)",
}

/** One glass frame around a plain grid, so a few hundred rows stay cheap to draw. */
export function WeaponTable({ rows }: { rows: readonly WeaponRow[] }) {
  return (
    <section
      aria-label={t.list}
      className="glass overflow-x-auto rounded-[14px] border border-border bg-surface"
    >
      <div className="min-w-[760px]">
        <div
          className={cn(GRID, "border-(--separator) border-b px-4 py-2.5 text-[12px] text-muted")}
        >
          {COLUMNS.map(column => (
            <span key={column}>{t.columns[column]}</span>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted">{t.none}</p>
        ) : (
          rows.map(row => <Row key={row.id} row={row} />)
        )}
      </div>
    </section>
  )
}

function Row({ row }: { row: WeaponRow }) {
  const { weapon, rarity } = row
  return (
    <div
      data-rise
      className={cn(GRID, "items-center border-(--separator) border-b px-4 py-2 text-[13px]")}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {/* Hidden: the name next to it says the same. */}
        <span aria-hidden className="contents">
          <WeaponTooltip weaponKey={weapon.key} refinement={weapon.refinement}>
            <GameIcon
              icon={row.icon}
              label={row.name}
              className={cn("size-[34px] rounded-[8px] text-[13px]", iconTone(rarity))}
            />
          </WeaponTooltip>
        </span>
        <span className="truncate font-medium">{row.name}</span>
      </span>
      <span className="text-muted">{row.type && text.game.weaponTypes[row.type]}</span>
      <span
        className={cn(
          "font-semibold tabular",
          (rarity !== undefined && RARITY_TEXT[rarity]) || "text-muted",
        )}
      >
        {rarity !== undefined && text.game.rarity(rarity)}
      </span>
      <span className="tabular">
        {weapon.level}
        <span className="text-muted">{t.levelCap(levelCap(weapon.ascension))}</span>
      </span>
      <span className="tabular">{text.characters.refinement(weapon.refinement)}</span>
      <span className={cn("min-w-0 truncate", !row.wielder && "text-muted")}>
        {row.wielder?.name ?? t.unequipped}
      </span>
      <span className="flex text-muted">
        {weapon.lock && <Lock role="img" aria-label={t.locked} className="size-[15px]" />}
      </span>
    </div>
  )
}
