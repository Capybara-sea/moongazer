// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ReactNode } from "react"
import { FilterChip } from "@/components/FilterChip"
import { GameIcon } from "@/components/GameIcon"
import { iconTone } from "@/components/RarityChip"
import { useTip } from "@/components/Tip"
import { ELEMENT_ICONS, ELEMENTS, WEAPON_TYPES } from "@/domain/elements"
import { characterData, lookup } from "@/domain/names"
import { cn } from "@/lib/cn"
import { text } from "@/text/zh"
import { type Filters, type Option, RARITIES } from "./addOptions"

const t = text.planner

type Props = {
  kind: "character" | "weapon"
  options: readonly Option[]
  filters: Filters
  onFilters: (filters: Filters) => void
  /** The tile for one not out yet, first whatever the filters; none when replacing one. */
  onCustom?: () => void
  onPick: (option: Option) => void
}

/** The filters, then a tile per character or weapon; planned ones cannot be picked again. */
export function GoalPicker({ kind, options, filters, onFilters, onCustom, onPick }: Props) {
  const set = (change: Partial<Filters>) => onFilters({ ...filters, ...change })
  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {kind === "character" && (
          <ChipGroup
            label={t.filters.element}
            value={filters.element}
            options={ELEMENTS.map(element => ({
              value: element,
              label: text.game.elementLong(text.game.elements[element]),
              icon: ELEMENT_ICONS[element],
            }))}
            onChange={element => set({ element })}
          />
        )}
        <ChipGroup
          label={t.filters.rarity}
          value={filters.rarity}
          options={RARITIES[kind].map(rarity => ({
            value: rarity,
            label: text.game.rarity(rarity),
          }))}
          onChange={rarity => set({ rarity })}
        />
        <ChipGroup
          label={t.filters.weapon}
          value={filters.weapon}
          options={WEAPON_TYPES.map(type => ({ value: type, label: text.game.weaponTypes[type] }))}
          onChange={weapon => set({ weapon })}
        />
      </div>
      <ul className="grid max-h-[52vh] grid-cols-[repeat(auto-fill,minmax(100px,1fr))] content-start gap-1.5 overflow-y-auto pr-1">
        {onCustom && <Tile name={t.addCustom[kind]} placeholder="?" onPick={onCustom} />}
        {options.length === 0 && (
          <li className="col-span-full py-6 text-center text-muted">{t.noMatch}</li>
        )}
        {options.map(option => (
          <Tile
            key={option.id}
            name={option.name}
            icon={option.icon}
            rarity={option.rarity}
            note={option.planned ? t.planned : option.note}
            detail={option.planned ? t.planned : option.detail}
            badge={option.wielder ? <Wielder wielder={option.wielder} /> : undefined}
            disabled={option.planned}
            onPick={() => onPick(option)}
          />
        ))}
      </ul>
    </>
  )
}

type ChipGroupProps<T> = {
  label: string
  value: T | null
  options: readonly { value: T; label: string; icon?: string }[]
  onChange: (value: T | null) => void
}

/** One filter: "all", then a chip per value; one with an icon shows the icon alone. */
function ChipGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: ChipGroupProps<T>) {
  return (
    <fieldset aria-label={label} className="flex flex-wrap gap-1">
      <FilterChip pressed={value === null} onPress={() => onChange(null)} className="h-8 px-2.5">
        {t.all}
      </FilterChip>
      {options.map(option =>
        option.icon ? (
          <FilterChip
            key={option.value}
            pressed={value === option.value}
            onPress={() => onChange(option.value)}
            label={option.label}
            className="h-8 w-8 justify-center px-0"
          >
            <span aria-hidden>
              <GameIcon icon={option.icon} label={option.label} className="size-4 text-[10px]" />
            </span>
          </FilterChip>
        ) : (
          <FilterChip
            key={option.value}
            pressed={value === option.value}
            onPress={() => onChange(option.value)}
            className="h-8 px-2.5"
          >
            {option.label}
          </FilterChip>
        ),
      )}
    </fieldset>
  )
}

type TileProps = {
  name: string
  icon?: string
  placeholder?: string
  rarity?: number
  note?: string
  detail?: string
  badge?: ReactNode
  disabled?: boolean
  onPick: () => void
}

function Tile({
  name,
  icon,
  placeholder,
  rarity,
  note,
  detail,
  badge,
  disabled,
  onPick,
}: TileProps) {
  const more = detail ?? note
  const tip = useTip<HTMLLIElement>(
    <>
      <span className="font-semibold">{name}</span>
      {more && <span>{more}</span>}
    </>,
  )
  return (
    <li {...tip.props}>
      <button
        type="button"
        disabled={disabled}
        aria-description={detail}
        onClick={onPick}
        className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-[12px] p-1.5 transition-colors duration-150 hover:bg-default/50 disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none"
      >
        <span className="relative w-full">
          <GameIcon
            icon={icon}
            label={name}
            placeholder={placeholder}
            className={cn("aspect-square w-full rounded-[12px] text-[22px]", iconTone(rarity))}
          />
          {badge}
        </span>
        <span className="w-full truncate text-center text-[13px] leading-tight">{name}</span>
        <span className="h-4 w-full truncate text-center text-[11px] text-muted leading-4">
          {note}
        </span>
      </button>
      {tip.bubble}
    </li>
  )
}

/** Who wields an owned weapon, on the weapon's icon. */
function Wielder({ wielder }: { wielder: string }) {
  const data = characterData(wielder)
  const name = wielder === "Traveler" ? lookup("characters", "Traveler").name : data.name
  return (
    <span aria-hidden className="absolute right-0.5 bottom-0.5">
      <GameIcon
        icon={data.icon}
        label={name}
        className="size-6 rounded-full border border-border bg-surface-secondary text-[10px]"
      />
    </span>
  )
}
