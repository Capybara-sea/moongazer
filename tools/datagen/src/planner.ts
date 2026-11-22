// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Game } from "./agdItems.ts"
import { TWINS } from "./animeGameData.ts"
import { type Talent, TRAVELER_ELEMENTS } from "./builds.ts"
import { customTemplate, customWeaponTemplate, type Slot, type WeaponSlot } from "./customCosts.ts"
import { talentOrders } from "./manual.ts"
import { byId, byPhase, expItems, expList, hasGaps, openDays, sameCaps } from "./plannerTables.ts"
import { goodKey, type Ids, list, num, type Raw } from "./tables.ts"

/** Material GOOD key to count; Mora is one of the materials. */
export type Cost = Record<string, number>
export type Planner = {
  /**
   * Cost lists, which characters and weapons point into by index: an ascension list's item i is
   * phase i + 1, a talent list's item i is level i + 2.
   */
  costs: Cost[][]
  /** `talents` in the order normal attack, skill, burst; `order` puts the most worth raising first. */
  characters: Record<string, { ascension: number; talents: number[]; order: Talent[] }>
  weapons: Record<string, { ascension: number }>
  /** The level cap at each ascension phase, from phase 0. */
  characterCaps: number[]
  /** By weapon rarity. */
  weaponCaps: Record<string, number[]>
  /** The ascension phases each talent level needs, from level 1. */
  talentAscension: number[]
  /** The EXP from each level to the next, from level 1; weapons' by rarity. */
  characterExp: number[]
  weaponExp: Record<string, number[]>
  /** The EXP one of each item gives. */
  characterExpItems: Record<string, number>
  weaponExpItems: Record<string, number>
  /** The material three of which make one of the key, for the materials costs name. */
  combine: Record<string, string>
  /** The Mora combining one of the key costs. */
  combineMora: Record<string, number>
  /**
   * The days a talent or weapon material's domain gives it: 0 Monday and Thursday, 1 Tuesday and
   * Friday, 2 Wednesday and Saturday; all of them give it on Sunday.
   */
  openDays: Record<string, number>
  /**
   * The costs of a character not out yet, indexed as `costs`' lists are. Its own materials are
   * "<slot>:<tier>", tier 0 the lowest, for one of the slot's families to fill in.
   */
  customCosts: { ascension: Cost[]; talent: Cost[] }
  /** The material families released characters use in each slot, in the game's order. */
  families: Record<Slot, string[][]>
  /** By rarity, the ascension costs of a weapon not out yet, as `customCosts` are a character's. */
  customWeaponCosts: Record<string, Cost[]>
  /** The material families released weapons use in each slot, in the game's order. */
  weaponFamilies: Record<WeaponSlot, string[][]>
}

type Custom = "customCosts" | "families" | "customWeaponCosts" | "weaponFamilies"

const TALENTS: Talent[] = ["auto", "skill", "burst"]
const MAX_TALENT = 10

/**
 * Ascension and talent costs, level caps, EXP and the rest the planner needs, by the GOOD keys of
 * names.json, which `ids` gives the ids of and `materialKeys` the materials of.
 * AnimeGameData leaves out fields at their default value, such as zeros and phase 0's number.
 */
export async function buildPlanner(g: Game, ids: Ids, materialKeys: Set<string>): Promise<Planner> {
  const [
    avatars,
    depots,
    skills,
    proudSkills,
    avatarPromotes,
    weapons,
    weaponPromotes,
    materials,
    avatarLevels,
    weaponLevels,
    recommendations,
    combines,
    daily,
    dungeons,
    previews,
  ] = await Promise.all(
    [
      "AvatarExcelConfigData.json",
      "AvatarSkillDepotExcelConfigData.json",
      "AvatarSkillExcelConfigData.json",
      "ProudSkillExcelConfigData.json",
      "AvatarPromoteExcelConfigData.json",
      "WeaponExcelConfigData.json",
      "WeaponPromoteExcelConfigData.json",
      "MaterialExcelConfigData.json",
      "AvatarLevelExcelConfigData.json",
      "WeaponLevelExcelConfigData.json",
      "AvatarRecommendDataExcelConfigData.json",
      "CombineExcelConfigData.json",
      "DailyDungeonConfigData.json",
      "DungeonExcelConfigData.json",
      "RewardPreviewExcelConfigData.json",
    ].map(g.table),
  )
  const materialById = byId(materials, "id")
  const keyOf = (id: unknown) => {
    const row = materialById.get(Number(id))
    const key = row ? goodKey(g.english(row.nameTextMapHash)) : ""
    if (!materialKeys.has(key)) throw new Error(`material ${id} has no key in names.json`)
    return key
  }
  /** The least id costs name each material by, which orders families as the game does. */
  const idOf = new Map<string, number>()
  const costOf = (items: unknown, mora: unknown): Cost => {
    const cost: Cost = {}
    for (const item of list(items ?? [], "costItems")) {
      if (item.id === undefined) continue
      const key = keyOf(item.id)
      cost[key] = (cost[key] ?? 0) + num(item, "count")
      idOf.set(key, Math.min(Number(item.id), idOf.get(key) ?? Number(item.id)))
    }
    if (typeof mora === "number" && mora > 0) cost.Mora = mora
    return cost
  }

  const costs: Cost[][] = []
  const indexOf = new Map<string, number>()
  const costIndex = (list: Cost[]) => {
    const json = JSON.stringify(list)
    let at = indexOf.get(json)
    if (at === undefined) {
      at = costs.push(list) - 1
      indexOf.set(json, at)
    }
    return at
  }

  const avatarPhases = byPhase(avatarPromotes, "avatarPromoteId")
  const characterCaps = sameCaps(avatarPhases.values(), "characters")
  const ascensionOf = (promoteId: unknown, what: string) => {
    const phases = avatarPhases.get(promoteId)
    if (!phases || phases.length !== characterCaps.length)
      throw new Error(`no ascension on ${what}`)
    return costIndex(phases.slice(1).map(row => costOf(row.costItems, row.scoinCost)))
  }

  const proudByGroup = new Map<unknown, Raw[]>()
  for (const row of proudSkills ?? []) {
    const level = Number(row.level ?? 0)
    if (level < 1 || level > MAX_TALENT) continue
    const levels = proudByGroup.get(row.proudSkillGroupId) ?? []
    levels[level - 1] = row
    proudByGroup.set(row.proudSkillGroupId, levels)
  }
  const skillById = byId(skills, "id")
  const talentAscensions = new Set<string>()
  const talentOf = (skillId: unknown, what: string) => {
    const levels = proudByGroup.get(skillById.get(skillId)?.proudSkillGroupId) ?? []
    if (levels.length !== MAX_TALENT || hasGaps(levels))
      throw new Error(`no talent levels on ${what}`)
    talentAscensions.add(JSON.stringify(levels.map(row => Number(row.breakLevel ?? 0))))
    return costIndex(levels.slice(1).map(row => costOf(row.costItems, row.coinCost)))
  }

  const depotById = byId(depots, "id")
  const skillSet = (depotId: unknown) => {
    const depot = depotById.get(depotId)
    const ids = Array.isArray(depot?.skills) ? depot.skills : []
    return [ids[0], ids[1], depot?.energySkill]
  }
  const avatarById = byId(avatars, "id")
  const recommended = new Map(
    (recommendations ?? []).flatMap(row =>
      Array.isArray(row.talents) && row.talents.length > 0 ? [[row.avatarId, row.talents]] : [],
    ),
  )
  /** The game's recommended order, by the skill set's own talents; none when it gives none. */
  const gameOrder = (avatarId: unknown, set: unknown[]) => {
    const ids = recommended.get(avatarId)
    if (!ids) return undefined
    const order = ids.map(id => TALENTS[set.indexOf(id)])
    if (order.length !== 3 || new Set(order).size !== 3 || order.includes(undefined)) {
      return undefined
    }
    return order as Talent[]
  }
  const unordered: string[] = []
  const orderOf = (key: string, game: Talent[] | undefined) => {
    const manual = talentOrders[key]
    if (game && manual) throw new Error(`${key} has the game's talent order and a manual one`)
    const order = game ?? manual
    if (!order) unordered.push(key)
    return order ?? []
  }

  const planner: Omit<Planner, Custom> = {
    costs,
    characters: {},
    weapons: {},
    characterCaps,
    weaponCaps: {},
    talentAscension: [],
    characterExp: expList(avatarLevels, row => num(row, "exp")),
    weaponExp: {},
    characterExpItems: expItems(materials, "ITEM_USE_ADD_EXP", keyOf),
    weaponExpItems: expItems(materials, "ITEM_USE_ADD_WEAPON_EXP", keyOf),
    combine: {},
    combineMora: {},
    openDays: {},
  }
  for (const [key, id] of ids.characters) {
    const avatar = avatarById.get(id)
    if (!avatar) throw new Error(`no avatar ${id}`)
    const set = skillSet(avatar.skillDepotId)
    planner.characters[key] = {
      ascension: ascensionOf(avatar.avatarPromoteId, key),
      talents: set.map(skill => talentOf(skill, key)),
      order: orderOf(key, gameOrder(id, set)),
    }
  }
  // Exports do not say which twin the Traveler is, so the twins must cost the same.
  const twins = TWINS.map(id => {
    const avatar = avatarById.get(id)
    if (!avatar) throw new Error(`no avatar ${id}`)
    const sets = (Array.isArray(avatar.candSkillDepotIds) ? avatar.candSkillDepotIds : []).flatMap(
      depotId => {
        const set = skillSet(depotId)
        const element = TRAVELER_ELEMENTS[String(skillById.get(set[2])?.costElemType)]
        return element ? [{ key: `Traveler${element}`, set }] : []
      },
    )
    return sets.map(({ key, set }) => ({
      key,
      ascension: ascensionOf(avatar.avatarPromoteId, key),
      talents: set.map(skill => talentOf(skill, key)),
      game: gameOrder(id, set),
    }))
  })
  const [traveler, ...others] = twins.map(sets =>
    JSON.stringify(sets.map(s => ({ ...s, game: 0 }))),
  )
  if (!traveler || others.some(other => other !== traveler)) throw new Error("the twins differ")
  for (const { key, ascension, talents } of twins[0] ?? []) {
    // The game may recommend an order for one twin only; where both have one, they must agree.
    const games = new Set(
      twins.flatMap(sets => {
        const game = sets.find(s => s.key === key)?.game
        return game ? [JSON.stringify(game)] : []
      }),
    )
    if (games.size > 1) throw new Error(`the twins' talent orders differ on ${key}`)
    const [game] = games
    planner.characters[key] = {
      ascension,
      talents,
      order: orderOf(key, game === undefined ? undefined : (JSON.parse(game) as Talent[])),
    }
  }
  if (unordered.length > 0) throw new Error(`no talent order for ${unordered.join(", ")}`)
  const unused = Object.keys(talentOrders).filter(key => !(key in planner.characters))
  if (unused.length > 0) throw new Error(`manual talent orders for unknown ${unused.join(", ")}`)

  if (talentAscensions.size !== 1) throw new Error("talents need different ascensions")
  planner.talentAscension = JSON.parse([...talentAscensions][0] ?? "[]") as number[]

  const weaponById = byId(weapons, "id")
  const weaponPhases = byPhase(weaponPromotes, "weaponPromoteId")
  const capsByRarity = new Map<number, Raw[][]>()
  const weaponRarity = new Map<string, number>()
  for (const [key, id] of ids.weapons) {
    const weapon = weaponById.get(id)
    const phases = weaponPhases.get(weapon?.weaponPromoteId)
    if (!weapon || !phases) throw new Error(`no ascension on weapon ${key}`)
    const rarity = num(weapon, "rankLevel")
    capsByRarity.set(rarity, [...(capsByRarity.get(rarity) ?? []), phases])
    weaponRarity.set(key, rarity)
    planner.weapons[key] = {
      ascension: costIndex(phases.slice(1).map(row => costOf(row.costItems, row.coinCost))),
    }
  }
  for (const [rarity, phases] of [...capsByRarity].sort(([a], [b]) => a - b)) {
    planner.weaponCaps[rarity] = sameCaps(phases, `${rarity}★ weapons`)
    planner.weaponExp[rarity] = expList(weaponLevels, row => {
      const exps = Array.isArray(row.requiredExps) ? row.requiredExps : []
      return Number(exps[rarity - 1])
    })
  }

  const needed = new Set(costs.flat().flatMap(cost => Object.keys(cost)))
  for (const row of combines ?? []) {
    if (row.recipeType !== "RECIPE_TYPE_COMBINE" || Number(row.resultItemCount ?? 0) !== 1) continue
    const items = list(row.materialItems ?? [], "materialItems").filter(i => i.id !== undefined)
    const [from] = items
    if (items.length !== 1 || !from || num(from, "count") !== 3) continue
    const result = keyOf(row.resultItemId)
    if (!needed.has(result)) continue
    const lower = keyOf(from.id)
    const kept = planner.combine[result]
    if (kept !== undefined && kept !== lower) throw new Error(`${result} combines from two items`)
    planner.combine[result] = lower
    planner.combineMora[result] = Number(row.scoinCost ?? 0)
  }

  planner.openDays = openDays(daily, byId(dungeons, "id"), byId(previews, "id"), keyOf, needed)
  const rankOf = (key: string) => Number(materialById.get(idOf.get(key))?.rankLevel ?? 0)
  return {
    ...planner,
    // ids.characters has no Traveler, whose talents need books of several kinds.
    ...customTemplate(planner, ids.characters.keys(), idOf),
    ...customWeaponTemplate(planner, weaponRarity, rankOf, idOf),
  }
}
