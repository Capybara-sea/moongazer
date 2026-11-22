// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"
import { GameIcon } from "@/components/GameIcon"
import { LabeledSelect } from "@/components/LabeledSelect"
import { iconTone } from "@/components/RarityChip"
import { familyOptions, SLOTS } from "@/domain/customCharacter"
import { CUSTOM_WEAPON_RARITIES, WEAPON_SLOTS, weaponFamilyOptions } from "@/domain/customWeapon"
import { isWeaponType, WEAPON_TYPES } from "@/domain/elements"
import { materialData } from "@/domain/names"
import type { CustomGoal, CustomWeaponGoal, Goal } from "@/domain/plan"
import { cn } from "@/lib/cn"
import { text } from "@/text/zh"
import { Choice } from "./Choice"
import type { Update } from "./GoalEditor"

const t = text.planner

type SlotPick = {
  value: string
  label: string
  icon?: string
  rarity?: number
  placeholder?: string
}

/** A pick with its material's icon, as LabeledSelect lays icons out. */
function withIcon({ value, label, icon, rarity, placeholder }: SlotPick) {
  return {
    value,
    label,
    icon: (
      <span aria-hidden className="contents">
        <GameIcon
          icon={icon}
          label={label}
          placeholder={placeholder}
          className={cn("size-full text-[11px]", iconTone(rarity))}
        />
      </span>
    ),
  }
}

const WEAPON_TYPE_OPTIONS = [
  { value: "", label: t.unknown },
  ...WEAPON_TYPES.map(type => ({ value: type, label: text.game.weaponTypes[type] })),
]

/** A slot's picks: not known yet, then each family by its top tier, in the game's order. */
function slotOptions(families: readonly string[][]) {
  const known = families.flatMap(family => {
    const top = family.at(-1)
    if (top === undefined) return []
    const { name, icon, rarity } = materialData(top)
    return [withIcon({ value: top, label: name, icon, rarity })]
  })
  return [withIcon({ value: "", label: t.unknown, placeholder: "?" }), ...known]
}

/** `slots` with `slot` set to the family of `top`, or not known when `top` is empty. */
function withSlot<S extends string>(
  all: readonly S[],
  slots: Partial<Record<S, string>>,
  slot: S,
  top: string,
) {
  const next: Partial<Record<S, string>> = {}
  for (const each of all) {
    const value = each === slot ? top : slots[each]
    if (value) next[each] = value
  }
  return next
}

type Slot = { id: string; label: string; value: string; families: readonly string[][] }
type Custom = CustomGoal | CustomWeaponGoal
type Fields = {
  rarities: { rarity: number; pick: () => void }[]
  slots: Slot[]
  setSlot: (id: string, top: string) => void
}

/** The rarities offered and the material slots of a custom character or weapon. */
function fieldsOf(goal: Custom, update: Update): Fields {
  if (goal.kind === "custom") {
    const edit = (change: (goal: CustomGoal) => Goal) =>
      update(g => (g.kind === "custom" ? change(g) : g))
    return {
      rarities: ([4, 5] as const).map(rarity => ({
        rarity,
        pick: () => edit(g => ({ ...g, rarity })),
      })),
      slots: SLOTS.map(
        (slot): Slot => ({
          id: slot,
          label: t.slots[slot],
          value: goal.slots[slot] ?? "",
          families: familyOptions(slot),
        }),
      ),
      setSlot: (id: string, top: string) => {
        const slot = SLOTS.find(each => each === id)
        if (slot) edit(g => ({ ...g, slots: withSlot(SLOTS, g.slots, slot, top) }))
      },
    }
  }
  const edit = (change: (goal: CustomWeaponGoal) => Goal) =>
    update(g => (g.kind === "customWeapon" ? change(g) : g))
  return {
    rarities: CUSTOM_WEAPON_RARITIES.map(rarity => ({
      rarity,
      pick: () => edit(g => ({ ...g, rarity })),
    })),
    slots: WEAPON_SLOTS.map(
      (slot): Slot => ({
        id: slot,
        label: t.weaponSlots[slot],
        value: goal.slots[slot] ?? "",
        families: weaponFamilyOptions(slot),
      }),
    ),
    setSlot: (id: string, top: string) => {
      const slot = WEAPON_SLOTS.find(each => each === id)
      if (slot) edit(g => ({ ...g, slots: withSlot(WEAPON_SLOTS, g.slots, slot, top) }))
    },
  }
}

type Props = { goal: Custom; update: Update }

/**
 * A custom character's or weapon's name, rarity and material slots, each "?"
 * till known; a weapon's type too.
 */
export function CustomFields({ goal, update }: Props) {
  // A blank name is not saved, as saved plans drop custom goals without one.
  const [name, setName] = useState(goal.name)
  const { rarities, slots, setSlot } = fieldsOf(goal, update)
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-[9px] border border-(--field-border) bg-(--field-background) px-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2">
          <span className="flex-none text-muted">{t.name}</span>
          <input
            value={name}
            onChange={e => {
              const value = e.currentTarget.value
              setName(value)
              if (value.trim()) {
                update(g =>
                  g.kind === "custom" || g.kind === "customWeapon"
                    ? { ...g, name: value.trim() }
                    : g,
                )
              }
            }}
            onBlur={() => setName(goal.name)}
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none"
          />
        </label>
        <fieldset aria-label={t.rarity} className="flex items-center gap-1.5">
          <span aria-hidden className="text-muted">
            {t.rarity}
          </span>
          {rarities.map(({ rarity, pick }) => (
            <Choice
              key={rarity}
              label={text.game.rarity(rarity)}
              selected={goal.rarity === rarity}
              onPick={pick}
              className="w-10"
            />
          ))}
        </fieldset>
        {goal.kind === "customWeapon" && (
          <LabeledSelect
            label={t.weaponType}
            value={goal.type ?? ""}
            options={WEAPON_TYPE_OPTIONS}
            onChange={value =>
              update(g =>
                g.kind === "customWeapon"
                  ? { ...g, type: isWeaponType(value) ? value : undefined }
                  : g,
              )
            }
            className="w-[168px]"
          />
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {slots.map(slot => (
          <LabeledSelect
            key={slot.id}
            label={slot.label}
            value={slot.value}
            options={slotOptions(slot.families)}
            onChange={top => setSlot(slot.id, top)}
            className="min-w-0"
          />
        ))}
      </div>
    </section>
  )
}
