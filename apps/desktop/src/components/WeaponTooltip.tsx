// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Fragment, type ReactNode } from "react"
import { weaponData, weaponPassive } from "@/domain/names"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { HoverPreview } from "./HoverPreview"
import { RarityChip } from "./RarityChip"

type Props = {
  weaponKey: string
  refinement: number
  children: ReactNode
}

/**
 * A weapon's passive at its refinement and the game's description of it,
 * shown after the pointer rests on the children.
 */
export function WeaponTooltip({ weaponKey, refinement, children }: Props) {
  return (
    <HoverPreview
      preview={<WeaponPreview weaponKey={weaponKey} refinement={refinement} />}
      previewClassName="w-[320px] gap-1.5"
    >
      {children}
    </HoverPreview>
  )
}

/** A value at every refinement, as in "28%/35%/42%", with the weapon's own one highlighted. */
function RefinementValues({ values, current }: { values: readonly string[]; current: number }) {
  return (
    <span className="text-muted">
      {values.map((value, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one value per refinement, in order
        <Fragment key={i}>
          {i > 0 && "/"}
          <span className={cn(i === current && "font-semibold text-(--accent-text)")}>{value}</span>
        </Fragment>
      ))}
    </span>
  )
}

function WeaponPreview({ weaponKey, refinement }: { weaponKey: string; refinement: number }) {
  const { name, rarity, type, flavor } = weaponData(weaponKey)
  const passive = weaponPassive(weaponKey, refinement)
  const meta = [type && text.game.weaponTypes[type], text.characters.refinement(refinement)]
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="min-w-0 font-semibold text-[13px]">{name}</span>
        {rarity !== undefined && <RarityChip rarity={rarity} className="px-[5px] py-0" />}
        <span className="ml-auto flex-none text-[11px] text-muted">
          {meta.filter(part => part !== undefined).join(" · ")}
        </span>
      </span>
      {passive && (
        <>
          <span className="font-semibold text-(--accent-text)">{passive.name}</span>
          <span className="whitespace-pre-line">
            {passive.segments.map((segment, i) =>
              segment.byRefinement ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: a passive's segments never reorder
                <RefinementValues key={i} {...segment.byRefinement} />
              ) : (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: a passive's segments never reorder
                  key={i}
                  className={cn(segment.highlight && "font-semibold text-(--accent-text)")}
                >
                  {segment.text}
                </span>
              ),
            )}
          </span>
        </>
      )}
      {flavor && (
        <span className="whitespace-pre-line border-(--separator) border-t pt-1.5 text-muted">
          {flavor}
        </span>
      )}
    </>
  )
}
