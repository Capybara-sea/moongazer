// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * The game's conversions the plan may count on when the player allows them:
 * an element gem into another element's of the same tier for Dust of Azoth,
 * and a weekly boss's drop into another of the same boss's for Dream Solvent.
 * Only what is left after every card took its share and combined is
 * converted, so converting never leaves another card short.
 */

import { planner as data } from "@/domain/gameData"
import { type Line, type Need, tierOf } from "@/domain/planner"

export const CONVERT_KINDS = ["gem", "weekly"] as const
export type ConvertKind = (typeof CONVERT_KINDS)[number]

/** Materials any of which converts into any other, each for `count` of `cost`. */
type Group = { kind: ConvertKind; cost: string; count: number; members: string[] }

const groups = new Map<string, Group>()
/** A material each cost item converts, for listing it with what it converts. */
const paidFor = new Map<string, string>()
for (const kind of CONVERT_KINDS) {
  for (const group of data.convert[kind]) {
    for (const member of group.members) groups.set(member, { ...group, kind })
    if (group.members[0] !== undefined) paidFor.set(group.cost, group.members[0])
  }
}

/** Whether `key` is what conversions are paid in: Dust of Azoth or Dream Solvent. */
export function isConvertCost(key: string) {
  return paidFor.has(key)
}

/** A material that `key`, a cost item, converts; none for any other material. */
export function convertedBy(key: string): string | undefined {
  return paidFor.get(key)
}

/** What the cards left of the bag: it less what each took and what combining used. */
function leftOver(cards: Line[][], bag: ReadonlyMap<string, number>) {
  const left = new Map(bag)
  const take = (key: string, count: number) => left.set(key, (left.get(key) ?? 0) - count)
  for (const line of cards.flat()) {
    take(line.key, line.have - line.made)
    for (const [key, count] of line.used) take(key, count)
  }
  return left
}

/** Each gem's element over all four tiers, with each tier's worth in slivers. */
const elements = new Map<string, { key: string; worth: number }[]>()
for (const group of data.convert.gem) {
  for (const member of group.members) {
    const element = member.replace(/(Sliver|Fragment|Chunk|Gemstone)$/, "")
    const tiers = elements.get(element) ?? []
    tiers.push({ key: member, worth: group.count })
    elements.set(element, tiers)
  }
}

/** How much the bag holds of `key`'s kind: a gem's element over all four tiers, in slivers. */
function total(key: string, bag: ReadonlyMap<string, number>) {
  const tiers = elements.get(key.replace(/(Sliver|Fragment|Chunk|Gemstone)$/, ""))
  if (!tiers) return bag.get(key) ?? 0
  return tiers.reduce((sum, tier) => sum + (bag.get(tier.key) ?? 0) * tier.worth, 0)
}

/** The others of `key`'s group, the kind the bag holds most of in all first. */
function donors(group: Group, key: string, bag: ReadonlyMap<string, number>) {
  return group.members
    .filter(member => member !== key)
    .toSorted((a, b) => total(b, bag) - total(a, bag))
}

/**
 * Makes up what each card is still short of materials of the `kinds`
 * allowed, by converting what is left of the others of the same tier, from
 * the one the bag holds most of first, as far as the cost item left pays
 * for it; cards in order, a card's lower tiers first. A card that converts
 * gets a line for each cost item it pays, all of it covered. `cards` are as
 * `allocate` shares the same bag out; the lines are not changed in place.
 */
export function convertShort(
  cards: Line[][],
  bag: ReadonlyMap<string, number>,
  kinds: readonly ConvertKind[],
): Line[][] {
  if (kinds.length === 0) return cards
  const left = leftOver(cards, bag)
  return cards.map(card => {
    const lines = card.map(line => ({ ...line }))
    const paid = new Map<string, Line>()
    for (const line of lines.toSorted((a, b) => tierOf(a.key) - tierOf(b.key))) {
      const group = groups.get(line.key)
      if (!group || !kinds.includes(group.kind) || line.have >= line.need) continue
      const stock = left.get(group.cost) ?? 0
      let wanted = Math.min(line.need - line.have, Math.floor(stock / group.count))
      const from: Need = new Map()
      for (const donor of donors(group, line.key, bag)) {
        const take = Math.min(wanted, left.get(donor) ?? 0)
        if (take <= 0) continue
        from.set(donor, take)
        left.set(donor, (left.get(donor) ?? 0) - take)
        wanted -= take
      }
      const count = [...from.values()].reduce((sum, n) => sum + n, 0)
      if (count === 0) continue
      const cost = count * group.count
      left.set(group.cost, stock - cost)
      line.have += count
      line.converted = { count, from, cost: group.cost, paid: cost }
      const spent = paid.get(group.cost) ?? {
        key: group.cost,
        need: 0,
        have: 0,
        made: 0,
        used: new Map(),
        bag: stock,
      }
      spent.need += cost
      spent.have += cost
      paid.set(group.cost, spent)
    }
    return [...lines, ...paid.values()]
  })
}
