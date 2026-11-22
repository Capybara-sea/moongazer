// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { talentBoosts } from "@/domain/builds"
import { customNeed, isUnknown } from "@/domain/customCharacter"
import type { Weapon } from "@/domain/good"
import { materialData } from "@/domain/names"
import {
  type CustomGoal,
  EMPTY_PLAN,
  goalName,
  knownLike,
  MORA_EXP_GROUP,
  materialTotals,
  orderGroups,
  planCards,
  SPECIALTY_GROUP,
  stepCost,
  summaryGroup,
  talentOrder,
  WEEKLY_BOSS_GROUP,
  type WeaponGoal,
  WORLD_BOSS_GROUP,
} from "@/domain/plan"
import { replaceCustom } from "@/domain/planEdits"
import {
  CHARACTER_EXP,
  type CharacterState,
  characterNeed,
  covers,
  plannerBag,
  START,
} from "@/domain/planner"
import { parsePlan } from "@/domain/savedPlan"

function account(characters: Account["characters"], weapons: Weapon[] = []): Account {
  return {
    characters,
    weapons,
    artifacts: [],
    materials: new Map(),
    characterInfo: new Map(),
  }
}

describe("plans", () => {
  const ayaka = {
    key: "KamisatoAyaka",
    level: 80,
    ascension: 6,
    constellation: 0,
    talent: { auto: 1, skill: 6, burst: 6 },
  }
  const goal = {
    id: "a",
    kind: "character" as const,
    key: "KamisatoAyaka",
    to: { stage: { level: 90, phase: 6 }, talents: { auto: 1, skill: 8, burst: 8 } },
  }

  it("keeps the goals that check out", () => {
    const plan = parsePlan({ goals: [goal, { id: "b", kind: "character", key: "Nobody" }, 3] })
    expect(plan.goals).toEqual([{ ...goal, order: undefined }])
    expect(parsePlan("nonsense")).toEqual(EMPTY_PLAN)
  })

  it("raises the level before talents, and only with what the card gets", () => {
    const plan = { goals: [goal], focus: "important" as const }
    const [poor] = planCards(plan, account([ayaka]), new Map())
    expect(poor?.steps).toEqual([])
    expect(poor?.standing).toBe("owned")
    // 80 to 90 takes about 240 Hero's Wit.
    const rich = new Map([
      ["HerosWit", 400],
      ["Mora", 10_000_000],
    ])
    const [card] = planCards(plan, account([ayaka]), plannerBag(rich))
    expect(card?.steps).toEqual([{ kind: "level", to: { level: 90, phase: 6 } }])
  })

  it("counts a character the account lacks from level 1", () => {
    const [card] = planCards({ goals: [goal], focus: "ready" }, account([]), new Map())
    expect(card?.standing).toBe("unowned")
    expect(card?.from).toEqual(START)
    expect(card?.bonus).toEqual({ auto: 0, skill: 0, burst: 0 })
  })

  it("knows the +3 constellations give, while goals keep base levels", () => {
    const [third, fifth] = talentBoosts(ayaka.key)
    if (!third || !fifth) throw new Error("no boosts")
    const plan = { goals: [goal], focus: "important" as const }
    const bonus = (constellation: number) =>
      planCards(plan, account([{ ...ayaka, constellation }]), new Map())[0]?.bonus
    expect(bonus(2)).toEqual({ auto: 0, skill: 0, burst: 0 })
    expect(bonus(3)?.[third]).toBe(3)
    expect(bonus(3)?.[fifth]).toBe(0)
    expect(bonus(6)?.[fifth]).toBe(3)
    expect(planCards(plan, account([{ ...ayaka, constellation: 6 }]), new Map())[0]?.from).toEqual(
      planCards(plan, account([ayaka]), new Map())[0]?.from,
    )
  })

  it("cost one step from where the item is now", () => {
    const [card] = planCards({ goals: [goal], focus: "ready" }, account([ayaka]), new Map())
    if (!card) throw new Error("no card")
    const from = { stage: { level: 80, phase: 6 }, talents: ayaka.talent }
    const level = stepCost(card, { kind: "level", to: { level: 90, phase: 6 } })
    expect(level).toEqual(
      characterNeed(ayaka.key, from, { ...from, stage: { level: 90, phase: 6 } }),
    )
    const skill = stepCost(card, { kind: "talent", talent: "skill", to: 7 })
    expect(skill).toEqual(
      characterNeed(ayaka.key, from, { ...from, talents: { ...from.talents, skill: 7 } }),
    )
    expect(skill.get("PhilosophiesOfElegance")).toBe(4)
  })
})

describe("Traveler goals", () => {
  const traveler = {
    key: "TravelerAnemo",
    level: 70,
    ascension: 5,
    constellation: 0,
    talent: { auto: 6, skill: 6, burst: 6 },
  }
  const to = (level: number, phase: number, skill = 0): CharacterState => ({
    stage: { level, phase },
    talents: { auto: 0, skill, burst: 0 },
  })
  const goal = (id: string, key: string, target: CharacterState) => ({
    id,
    kind: "character" as const,
    key,
    to: target,
  })
  const rich = plannerBag(
    new Map([
      ["HerosWit", 1000],
      ["Mora", 100_000_000],
      ["BrilliantDiamondGemstone", 50],
      ["OminousMask", 200],
      ["WindwheelAster", 200],
    ]),
  )

  it("count the level all elements share once, on the first card that raises it", () => {
    const goals = [goal("a", "TravelerAnemo", to(90, 6)), goal("g", "TravelerGeo", to(90, 6, 4))]
    const [anemo, geo] = planCards({ goals, focus: "ready" }, account([traveler]), rich)
    expect(anemo?.need.get("BrilliantDiamondGemstone")).toBe(6)
    expect(geo?.standing).toBe("otherElement")
    expect(geo?.from.stage).toEqual({ level: 70, phase: 5 })
    expect(geo?.stageKeys.size).toBe(0)
    expect(geo?.need.has("BrilliantDiamondGemstone")).toBe(false)
    expect(geo?.need.has(CHARACTER_EXP)).toBe(false)
    // The level is the first card's step; talents wait for it.
    expect(anemo?.steps).toEqual([{ kind: "level", to: { level: 80, phase: 5 } }])
    expect(geo?.done).toBe(false)
    expect(geo?.steps).toEqual([])
  })

  it("count only the levels past what the cards before raise it to", () => {
    const goals = [goal("a", "TravelerAnemo", to(80, 6)), goal("g", "TravelerGeo", to(90, 6))]
    const [, geo] = planCards({ goals, focus: "ready" }, account([traveler]), rich)
    const at80 = { ...START, stage: { level: 80, phase: 6 } }
    const exp = characterNeed("TravelerGeo", at80, to(90, 6)).get(CHARACTER_EXP)
    expect(geo?.need.get(CHARACTER_EXP)).toBe(exp)
    expect(geo?.need.has("BrilliantDiamondGemstone")).toBe(false)
  })
})

describe("weapon goals", () => {
  const sword = (level: number, ascension: number, location: string, guid?: string): Weapon => ({
    key: "FavoniusSword",
    level,
    ascension,
    refinement: 1,
    location,
    lock: false,
    guid,
  })
  const goal = (over: Partial<WeaponGoal>): WeaponGoal => ({
    id: "w",
    kind: "weapon",
    key: "FavoniusSword",
    to: { level: 90, phase: 6 },
    ...over,
  })
  const cardOf = (weaponGoal: WeaponGoal, weapons: Weapon[]) =>
    planCards({ goals: [weaponGoal], focus: "ready" }, account([], weapons), new Map())[0]

  it("find the weapon by name and wielder in files without ids", () => {
    const card = cardOf(goal({ guid: "123", wielder: "Bennett" }), [sword(80, 6, "Bennett")])
    expect(card?.standing).toBe("owned")
    expect(card?.from.stage).toEqual({ level: 80, phase: 6 })
  })

  it("go by id alone in files with ids", () => {
    const card = cardOf(goal({ guid: "123", wielder: "Bennett" }), [sword(80, 6, "Bennett", "9")])
    expect(card?.standing).toBe("missing")
  })

  it("tell unequipped copies apart in files without ids", () => {
    const copies = [sword(1, 0, ""), sword(80, 6, "")]
    expect(cardOf(goal({ wielder: "", copy: 1 }), copies)?.from.stage).toEqual({
      level: 80,
      phase: 6,
    })
    expect(cardOf(goal({ wielder: "" }), copies)?.from.stage).toEqual({ level: 1, phase: 0 })
    const saved = parsePlan({ goals: [goal({ wielder: "", copy: 1 }), goal({ copy: -1 })] })
    expect(saved.goals.map(g => (g.kind === "weapon" ? g.copy : ""))).toEqual([1, undefined])
  })
})

describe("custom goals", () => {
  const custom: CustomGoal = {
    id: "c",
    kind: "custom",
    name: "Newcomer",
    rarity: 5,
    slots: { gem: "ShivadaJadeGemstone", book: "PhilosophiesOfElegance" },
    to: { stage: { level: 90, phase: 6 }, talents: { auto: 0, skill: 9, burst: 9 } },
  }

  it("keep what checks out, a slot of no known family left not known", () => {
    const saved = {
      ...custom,
      name: "  Newcomer ",
      slots: { ...custom.slots, common: "OldHandguard", boss: "Nothing", weekly: 3, other: "x" },
    }
    expect(parsePlan({ goals: [saved] }).goals).toEqual([{ ...custom, order: undefined }])
  })

  it("are dropped without a name or a 4- or 5-star rarity", () => {
    const bad = [
      { ...custom, rarity: 3 },
      { ...custom, rarity: "5" },
      { ...custom, name: " " },
    ]
    expect(parsePlan({ goals: bad }).goals).toEqual([])
  })

  it("turn into the released character, targets and talent order kept", () => {
    const plan = { goals: [{ ...custom, order: ["burst", "skill", "auto"] }], focus: "ready" }
    const next = replaceCustom(parsePlan(plan), "c", "KamisatoAyaka")
    expect(next.goals).toEqual([
      {
        id: "c",
        kind: "character",
        key: "KamisatoAyaka",
        to: custom.to,
        order: ["burst", "skill", "auto"],
      },
    ])
  })

  it("do not turn into a character planned already or one without data", () => {
    const ayaka = { id: "a", kind: "character" as const, key: "KamisatoAyaka", to: custom.to }
    const plan = { ...EMPTY_PLAN, goals: [custom, ayaka] }
    expect(replaceCustom(plan, "c", "KamisatoAyaka")).toBe(plan)
    expect(replaceCustom(plan, "c", "Nobody")).toBe(plan)
  })

  it("start from level 1 and get nothing of a material not known yet", () => {
    const bag = plannerBag(
      new Map([
        ["HerosWit", 1000],
        ["Mora", 10_000_000],
        ["ShivadaJadeSliver", 10],
        ["ShivadaJadeGemstone", 10],
      ]),
    )
    const [card] = planCards({ goals: [custom], focus: "ready" }, account([]), bag)
    expect(card?.standing).toBe("custom")
    expect(card?.from).toEqual(START)
    expect(goalName(custom)).toBe("Newcomer")
    expect(talentOrder(custom)).toEqual(["auto", "skill", "burst"])
    const unknown = card?.lines.filter(l => isUnknown(l.key)) ?? []
    expect(unknown.map(l => l.key)).toContain("?weekly:0")
    expect(unknown.every(l => l.have === 0)).toBe(true)
    expect(card?.lines.find(l => l.key === "ShivadaJadeGemstone")?.have).toBe(6)
    expect(card?.stageKeys.has("?specialty:0")).toBe(true)
    expect(card?.stageKeys.has("?weekly:0")).toBe(false)
    // Levelling to 20 takes EXP and Mora alone; the ascension after it is not covered.
    expect(card?.steps).toEqual([{ kind: "level", to: { level: 20, phase: 0 } }])
    const at20 = { ...START, stage: { level: 20, phase: 0 } }
    const ascend = customNeed(custom.slots, at20, { ...at20, stage: { level: 20, phase: 1 } })
    expect(ascend.get("ShivadaJadeSliver")).toBe(1)
    expect(covers(card?.lines ?? [], ascend)).toBe(false)
  })
})

describe("material totals", () => {
  const TOP = { level: 90, phase: 6 }
  const custom = (id: string, name: string): CustomGoal => ({
    id,
    kind: "custom",
    name,
    rarity: 5,
    slots: {},
    to: { stage: TOP, talents: { auto: 0, skill: 9, burst: 9 } },
  })

  it("add the cards up and name the goals that need each in card order, none switched off", () => {
    const ayaka = {
      id: "a",
      kind: "character" as const,
      key: "KamisatoAyaka",
      to: { stage: TOP, talents: { auto: 0, skill: 0, burst: 0 } },
    }
    const sword: WeaponGoal = {
      id: "s",
      kind: "weapon",
      key: "MistsplitterReforged",
      to: TOP,
      off: true,
    }
    const goals = [custom("x", "Newcomer"), ayaka, sword, custom("y", "Other")]
    const cards = planCards({ goals, focus: "ready" }, account([]), new Map())
    const totals = materialTotals(cards)
    const mora = totals.get("Mora")
    expect(mora?.goals).toEqual(["Newcomer", goalName(ayaka), "Other"])
    const moraOf = (i: number) => cards[i]?.lines.find(l => l.key === "Mora")?.need ?? 0
    expect(mora?.need).toBe(moraOf(0) + moraOf(1) + moraOf(3))
    expect(totals.get("?weekly:0")?.goals).toEqual(["Newcomer", "Other"])
  })
})

describe("summary groups", () => {
  it("put Mora with EXP, the rest by the game's type, those not known yet with their slot's", () => {
    expect(summaryGroup("Mora")).toBe(MORA_EXP_GROUP)
    expect(summaryGroup(CHARACTER_EXP)).toBe(MORA_EXP_GROUP)
    expect(summaryGroup("?book:2")).toBe(summaryGroup("PhilosophiesOfElegance"))
    expect(isUnknown(knownLike("?w-weapon:0"))).toBe(false)
    expect(summaryGroup("?w-weapon:3")).toBe(summaryGroup(knownLike("?w-weapon:0")))
    const book = materialData("PhilosophiesOfElegance").type
    expect(book).toBeTruthy()
    expect(summaryGroup("PhilosophiesOfElegance")).toBe(book)
  })

  it("keep world and weekly bosses' drops apart, though the game types them alike", () => {
    expect(materialData("HurricaneSeed").type).toBe(materialData("DvalinsPlume").type)
    expect(summaryGroup("HurricaneSeed")).toBe(WORLD_BOSS_GROUP)
    expect(summaryGroup("DvalinsPlume")).toBe(WEEKLY_BOSS_GROUP)
    expect(summaryGroup("?boss:0")).toBe(WORLD_BOSS_GROUP)
    expect(summaryGroup("?weekly:0")).toBe(WEEKLY_BOSS_GROUP)
  })

  it("put every region's specialties in one group", () => {
    expect(materialData("Cecilia").type).not.toBe(materialData("ClearwaterJade").type)
    expect(summaryGroup("Cecilia")).toBe(SPECIALTY_GROUP)
    expect(summaryGroup("ClearwaterJade")).toBe(SPECIALTY_GROUP)
  })

  it("keep the player's order, groups never moved in their default place", () => {
    expect(orderGroups(["a", "b", "c", "d"])).toEqual(["a", "b", "c", "d"])
    expect(orderGroups(["a", "b", "c", "d"], ["c", "a"])).toEqual(["c", "b", "a", "d"])
    expect(orderGroups(["a", "b"], ["x", "b", "a"])).toEqual(["b", "a"])
  })
})
