// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Cost, Planner } from "./planner.ts"

const SLOTS = ["common", "specialty", "boss", "gem", "book", "weekly"] as const
export type Slot = (typeof SLOTS)[number]
const WEAPON_SLOTS = ["weapon", "elite", "common"] as const
export type WeaponSlot = (typeof WEAPON_SLOTS)[number]
/** What every character's costs name alike, outside the slots. */
const SHARED = new Set(["Mora", "CrownOfInsight"])
/** Below this share of a rarity's weapons, the template most of them share is not trusted. */
const LEAST_SHARE = 0.9

/**
 * The one cost template the characters of `keys` share, found by cutting each one's materials into
 * slots by combine chain and use: four tiers are a gem; three tiers a common material when
 * ascension and talents both need them, a book when talents alone do; one tier a specialty or boss
 * material when ascension alone needs it (specialties from phase 1), a weekly boss material when
 * talents alone do. Throws when the characters do not all fit the one template.
 */
export function customTemplate(
  planner: Pick<Planner, "costs" | "characters" | "combine">,
  keys: Iterable<string>,
  idOf: Map<string, number>,
): Pick<Planner, "customCosts" | "families"> {
  const chainOf = chains(planner.combine)
  const used: Map<Slot, string[]>[] = []
  const templates = new Set<string>()
  for (const key of keys) {
    const character = planner.characters[key]
    const [talentAt, ...others] = character?.talents ?? []
    if (!character || talentAt === undefined || others.some(at => at !== talentAt)) {
      throw new Error(`${key}'s talents cost differently`)
    }
    const ascension = planner.costs[character.ascension] ?? []
    const talent = planner.costs[talentAt] ?? []
    const inAscension = new Set(ascension.flatMap(Object.keys))
    const inTalents = new Set(talent.flatMap(Object.keys))
    const materials = [...new Set([...inAscension, ...inTalents])].filter(m => !SHARED.has(m))
    const { slots, tokens } = slotted(key, materials, chainOf, (material, chain) =>
      slotOf(
        chain.length,
        inAscension.has(material),
        inTalents.has(material),
        material in (ascension[0] ?? {}),
      ),
    )
    if (slots.size !== SLOTS.length) throw new Error(`${key} lacks a material slot`)
    used.push(slots)
    templates.add(
      JSON.stringify({
        ascension: tokenized(ascension, tokens),
        talent: tokenized(talent, tokens),
      }),
    )
  }
  const [only] = templates
  if (templates.size !== 1 || only === undefined) throw new Error("characters cost differently")
  return {
    customCosts: JSON.parse(only) as Planner["customCosts"],
    families: families(SLOTS, used, idOf),
  }
}

/**
 * Each weapon rarity's ascension cost template, the one most weapons of the rarity share (some
 * cost oddly, such as nothing at all), and the material families weapons use in each slot. A
 * four-tier chain is the weapon ascension material; of the three-tier ones, the one from 2★ up
 * drops from elite enemies and the one from 1★ up from common ones. `rankOf` gives a material's
 * rarity. Throws when a material fits no slot or two fill one, or when under 90% of a rarity's
 * weapons share its template.
 */
export function customWeaponTemplate(
  planner: Pick<Planner, "costs" | "weapons" | "combine">,
  rarityOf: Map<string, number>,
  rankOf: (material: string) => number,
  idOf: Map<string, number>,
): Pick<Planner, "customWeaponCosts" | "weaponFamilies"> {
  const chainOf = chains(planner.combine)
  const used: Map<WeaponSlot, string[]>[] = []
  const templates = new Map<number, Map<string, number>>()
  for (const [key, weapon] of Object.entries(planner.weapons)) {
    const rarity = rarityOf.get(key)
    if (rarity === undefined) throw new Error(`no rarity for weapon ${key}`)
    const steps = planner.costs[weapon.ascension] ?? []
    const materials = [...new Set(steps.flatMap(Object.keys))].filter(m => m !== "Mora")
    const { slots, tokens } = slotted(key, materials, chainOf, (_, chain) =>
      weaponSlotOf(chain.length, rankOf(chain[0] ?? "")),
    )
    used.push(slots)
    const counts = templates.get(rarity) ?? new Map<string, number>()
    const template = JSON.stringify(tokenized(steps, tokens))
    templates.set(rarity, counts.set(template, (counts.get(template) ?? 0) + 1))
  }
  const customWeaponCosts: Record<string, Cost[]> = {}
  for (const [rarity, counts] of templates) {
    const [template, most] = [...counts].reduce((a, b) => (b[1] > a[1] ? b : a))
    const all = [...counts.values()].reduce((a, b) => a + b)
    if (most < all * LEAST_SHARE) throw new Error(`${rarity}★ weapons cost too differently`)
    customWeaponCosts[rarity] = JSON.parse(template) as Cost[]
  }
  return { customWeaponCosts, weaponFamilies: families(WEAPON_SLOTS, used, idOf) }
}

/** A material's combine chain, lowest tier first, by `combine`. */
function chains(combine: Record<string, string>) {
  const higher = new Map(Object.entries(combine).map(([result, from]) => [from, result]))
  return (key: string) => {
    let lowest = key
    for (let from = combine[key]; from; from = combine[from]) lowest = from
    const chain = [lowest]
    for (let next = higher.get(lowest); next; next = higher.get(next)) chain.push(next)
    return chain
  }
}

/**
 * The chain filling each slot of `key`'s `materials`, and the "<slot>:<tier>" token of each chain
 * item. Throws when a material fits no slot or two chains fill one.
 */
function slotted<S extends string>(
  key: string,
  materials: Iterable<string>,
  chainOf: (material: string) => string[],
  slotOf: (material: string, chain: string[]) => S | undefined,
) {
  const slots = new Map<S, string[]>()
  const tokens = new Map<string, string>()
  for (const material of materials) {
    const chain = chainOf(material)
    const slot = slotOf(material, chain)
    if (!slot) throw new Error(`no slot for ${material} of ${key}`)
    const kept = slots.get(slot)
    if (kept && kept[0] !== chain[0]) throw new Error(`${key} has two ${slot} materials`)
    slots.set(slot, chain)
    for (const [tier, item] of chain.entries()) tokens.set(item, `${slot}:${tier}`)
  }
  return { slots, tokens }
}

/** `steps` with the materials `tokens` names by their tokens, each cost's keys sorted. */
function tokenized(steps: Cost[], tokens: Map<string, string>) {
  return steps.map(cost =>
    Object.fromEntries(
      Object.entries(cost)
        .map(([item, count]) => [tokens.get(item) ?? item, count] as const)
        .sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
  )
}

/** The distinct chains `used` fill each slot with, by the game's order of their lowest tiers. */
function families<S extends string>(
  slots: readonly S[],
  used: Map<S, string[]>[],
  idOf: Map<string, number>,
) {
  const lowestId = (chain: string[]) => idOf.get(chain[0] ?? "") ?? 0
  return Object.fromEntries(
    slots.map(slot => {
      const distinct = new Map(
        used.flatMap(found => {
          const chain = found.get(slot)
          return chain ? [[chain.join(), chain] as const] : []
        }),
      )
      return [slot, [...distinct.values()].sort((a, b) => lowestId(a) - lowestId(b))]
    }),
  ) as Record<S, string[][]>
}

/** A character material's slot by its chain's tiers and what needs it; none when it fits none. */
function slotOf(
  tiers: number,
  ascension: boolean,
  talents: boolean,
  phase1: boolean,
): Slot | undefined {
  if (tiers === 4) return "gem"
  if (tiers === 3 && talents) return ascension ? "common" : "book"
  if (tiers !== 1 || ascension === talents) return undefined
  if (talents) return "weekly"
  return phase1 ? "specialty" : "boss"
}

/** A weapon material's slot by its chain's tiers and its lowest tier's rarity. */
function weaponSlotOf(tiers: number, lowestRarity: number): WeaponSlot | undefined {
  if (tiers === 4) return "weapon"
  if (tiers !== 3) return undefined
  if (lowestRarity === 2) return "elite"
  return lowestRarity === 1 ? "common" : undefined
}
