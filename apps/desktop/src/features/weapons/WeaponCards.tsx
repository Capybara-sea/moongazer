// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Lock } from "lucide-react"
import { memo, type ReactNode } from "react"
import { EmptyState } from "@/components/EmptyState"
import { GameIcon } from "@/components/GameIcon"
import { iconTone, RarityChip } from "@/components/RarityChip"
import { Tip } from "@/components/Tip"
import { WeaponTooltip } from "@/components/WeaponTooltip"
import { levelCap } from "@/domain/builds"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import type { WeaponRow } from "./order"

const t = text.weapons

/** The weapons as a grid of cards, the other view of the table. */
export function WeaponCards({ rows }: { rows: readonly WeaponRow[] }) {
  if (rows.length === 0) return <EmptyState>{t.none}</EmptyState>
  return (
    <section
      aria-label={t.cards}
      className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3"
    >
      {rows.map(row => (
        <Card key={row.id} row={row} />
      ))}
    </section>
  )
}

/** Cards whose row is unchanged are skipped when a filter changes. */
const Card = memo(WeaponCard)

function WeaponCard({ row }: { row: WeaponRow }) {
  const { weapon, rarity, wielder } = row
  return (
    // Cards out of view skip layout and paint, as the artifact cards do.
    <article className="glass flex min-w-0 flex-col gap-3 rounded-[14px] border border-border bg-surface p-3.5 [contain-intrinsic-size:auto_187px] [content-visibility:auto]">
      <div className="flex items-center gap-3">
        {/* Hidden: the name next to it says the same. */}
        <span aria-hidden className="contents">
          <WeaponTooltip weaponKey={weapon.key} refinement={weapon.refinement}>
            <GameIcon
              icon={row.icon}
              label={row.name}
              className={cn("size-[52px] rounded-[12px] text-[20px]", iconTone(rarity))}
            />
          </WeaponTooltip>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="line-clamp-2 font-semibold text-[15px] leading-[1.3]">{row.name}</h2>
            {rarity !== undefined && <RarityChip rarity={rarity} />}
          </div>
          <span className="text-[12px] text-muted">
            {row.type && text.game.weaponTypes[row.type]}
          </span>
        </div>
        {weapon.lock && (
          <Tip content={t.locked} className="flex flex-none self-start text-muted">
            <Lock role="img" aria-label={t.locked} className="size-[15px]" />
          </Tip>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Stat label={t.columns.level}>
          {weapon.level}
          <span className="font-normal text-muted">{t.levelCap(levelCap(weapon.ascension))}</span>
        </Stat>
        <Stat label={t.columns.refinement}>{text.characters.refinement(weapon.refinement)}</Stat>
      </div>
      <div className="flex min-w-0 items-center gap-2 border-(--separator) border-t pt-2.5 text-[12px]">
        {wielder ? (
          <>
            <span aria-hidden className="contents">
              <GameIcon
                icon={wielder.icon}
                label={wielder.name}
                className="size-[22px] rounded-[6px] bg-surface-secondary text-[11px] text-foreground"
              />
            </span>
            <span className="flex-none text-muted">{t.columns.wielder}</span>
            <span className="min-w-0 truncate">{wielder.name}</span>
          </>
        ) : (
          <span className="text-muted">{t.unequipped}</span>
        )}
      </div>
    </article>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="glass-inset flex min-w-0 flex-col rounded-[8px] bg-surface-secondary px-2 py-[5px]">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="whitespace-nowrap font-semibold text-[14px] tabular">{children}</span>
    </div>
  )
}
