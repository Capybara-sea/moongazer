// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronRight } from "lucide-react"
import { Fragment, type ReactNode } from "react"
import { GameIcon } from "@/components/GameIcon"
import { iconTone, RarityChip } from "@/components/RarityChip"
import { SetEffectTooltip } from "@/components/SetEffectTooltip"
import { WeaponTooltip } from "@/components/WeaponTooltip"
import type { Character } from "@/domain/good"
import { characterData } from "@/domain/names"
import { cn } from "@/lib/cn"
import { navigate } from "@/lib/route"
import { text } from "@/text/zh"
import { CharacterAvatar } from "./CharacterAvatar"
import { type CardInfo, type CardSet, traits } from "./cardInfo"

const t = text.characters

/** One character in the list, as in the design; the whole card opens its details. */
export function CharacterCard({ character, info }: { character: Character; info: CardInfo }) {
  const data = characterData(character.key)
  return (
    <button
      type="button"
      onClick={() => navigate("characters", character.key)}
      className="glass flex min-w-0 cursor-pointer flex-col gap-3 rounded-[14px] border border-border bg-surface p-3.5 text-left transition-colors hover:border-(--field-border)"
    >
      <span className="flex w-full items-center gap-3">
        {/* Hidden: the card's text names the character already. */}
        <span aria-hidden className="contents">
          <CharacterAvatar characterKey={character.key} size="card" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-[15px] leading-[1.3]">{data.name}</span>
            {data.rarity !== undefined && <RarityChip rarity={data.rarity} />}
          </span>
          <span className="truncate text-[12px] text-muted">
            {/* The avatar showing the element is hidden from screen readers. */}
            {data.element && (
              <span className="sr-only">
                {`${text.game.elementLong(text.game.elements[data.element])} `}
              </span>
            )}
            {traits(data)}
          </span>
        </span>
        <ChevronRight aria-hidden size={16} className="flex-none text-muted" />
      </span>
      <span className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))_max-content] gap-1.5">
        <Stat label={t.level}>{character.level}</Stat>
        <Stat label={t.constellation}>{t.constellationValue(character.constellation)}</Stat>
        <Stat label={t.friendship}>{info.friendship ?? text.number.missing}</Stat>
        <Stat label={t.talents}>
          <Talents talents={info.talents} />
        </Stat>
      </span>
      <span className="flex w-full flex-col gap-1.5 border-(--separator) border-t pt-2.5 text-[12px]">
        {info.weapon ? (
          <span className="flex items-center gap-2">
            <WeaponIcon weapon={info.weapon} className="size-6" />
            <span className="min-w-0 flex-1 truncate">{info.weapon.name}</span>
            <span className="flex-none text-muted tabular">
              {t.refinement(info.weapon.refinement)}
            </span>
          </span>
        ) : (
          <span className="truncate text-muted">{t.noWeapon}</span>
        )}
        {info.sets === undefined ? (
          <span className="truncate text-muted">{t.noArtifacts}</span>
        ) : (
          info.sets.length > 0 && (
            <span className="flex min-w-0 items-center gap-3">
              {info.sets.map(set => (
                <span key={set.key} className="flex min-w-0 items-center gap-2">
                  <SetIcon set={set} className="size-6" />
                  <span className="min-w-0 truncate text-muted">{set.name}</span>
                  <span className="flex-none text-muted tabular">{t.pieces(set.count)}</span>
                </span>
              ))}
            </span>
          )
        )}
      </span>
    </button>
  )
}

/** "9/9/13", the levels the constellations raise in the accent color. */
export function Talents({ talents }: { talents: CardInfo["talents"] }) {
  return talents.map((talent, i) => (
    <Fragment key={talent.key}>
      {i > 0 && <span className="text-muted">/</span>}
      <span className={cn(talent.boosted && "text-(--accent-text)")}>{talent.total}</span>
    </Fragment>
  ))
}

type IconProps = { icon?: string; label: string; rarity?: number; className: string }

/** A weapon's or set's icon on its rarity's color; hidden, as the name beside it says the same. */
export function ItemIcon({ icon, label, rarity, className }: IconProps) {
  return (
    <span aria-hidden className="contents">
      <GameIcon
        icon={icon}
        label={label}
        className={cn("rounded-[6px] text-[11px]", iconTone(rarity), className)}
      />
    </span>
  )
}

type CardWeapon = NonNullable<CardInfo["weapon"]>

/** A weapon's icon that shows its passive and description on hover. */
export function WeaponIcon({ weapon, className }: { weapon: CardWeapon; className: string }) {
  return (
    <WeaponTooltip weaponKey={weapon.key} refinement={weapon.refinement}>
      <ItemIcon
        icon={weapon.icon}
        label={weapon.name}
        rarity={weapon.rarity}
        className={className}
      />
    </WeaponTooltip>
  )
}

/** A set's icon that shows its effects on hover, muting those that need more pieces. */
export function SetIcon({ set, className }: { set: CardSet; className: string }) {
  return (
    <SetEffectTooltip setKey={set.key} equipped={set.count}>
      <ItemIcon icon={set.icon} label={set.name} rarity={set.rarity} className={className} />
    </SetEffectTooltip>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="glass-inset flex min-w-0 flex-col rounded-[8px] bg-surface-secondary px-2 py-[5px]">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="flex gap-0.5 whitespace-nowrap font-semibold text-[14px] tabular">
        {children}
      </span>
    </span>
  )
}
