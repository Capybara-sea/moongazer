// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Lock } from "lucide-react"
import { GameIcon } from "@/components/GameIcon"
import { Panel } from "@/components/Panel"
import { iconTone, RarityChip } from "@/components/RarityChip"
import { Tip } from "@/components/Tip"
import { WeaponTooltip } from "@/components/WeaponTooltip"
import { levelCap } from "@/domain/builds"
import type { Weapon } from "@/domain/good"
import { weaponData } from "@/domain/names"
import { cn } from "@/lib/cn"
import { text } from "@/text"

/** The equipped weapon: icon, name, rarity, level, ascension, refinement and lock. */
export function WeaponCard({ weapon }: { weapon?: Weapon }) {
  return (
    <Panel aria-label={text.characterDetail.weapon} className="gap-3 px-4.5 py-4">
      <h2 className="font-semibold text-[15px]">{text.characterDetail.weapon}</h2>
      {weapon ? (
        <Equipped weapon={weapon} />
      ) : (
        <p className="text-[13px] text-muted">{text.characters.noWeapon}</p>
      )}
    </Panel>
  )
}

function Equipped({ weapon }: { weapon: Weapon }) {
  const data = weaponData(weapon.key)
  return (
    <div className="flex items-center gap-3">
      {/* Hidden: the name next to it says the same. */}
      <span aria-hidden className="contents">
        <WeaponTooltip weaponKey={weapon.key} refinement={weapon.refinement}>
          <GameIcon
            icon={data.icon}
            label={data.name}
            className={cn("size-[52px] rounded-[12px] text-[20px]", iconTone(data.rarity))}
          />
        </WeaponTooltip>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-[15px]">{data.name}</span>
          {data.rarity !== undefined && <RarityChip rarity={data.rarity} />}
        </div>
        <span className="tabular text-[12px] text-muted">
          {text.characterDetail.weaponLine(
            weapon.level,
            levelCap(weapon.ascension),
            weapon.ascension,
            weapon.refinement,
          )}
        </span>
      </div>
      {weapon.lock && (
        <Tip content={text.characterDetail.locked} className="flex flex-none text-muted">
          <Lock role="img" aria-label={text.characterDetail.locked} className="size-[15px]" />
        </Tip>
      )}
    </div>
  )
}
