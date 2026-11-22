// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import {
  type CustomSlots,
  customNeed,
  familyOptions,
  isUnknown,
  unknownSlot,
} from "@/domain/customCharacter"
import { gameWeekday } from "@/domain/gameTime"
import {
  allocate,
  CHARACTER_EXP,
  characterCaps,
  characterNeed,
  covers,
  lowerTier,
  type Need,
  openGroup,
  openOn,
  plannerBag,
  START,
  stageStep,
  stages,
  talentCap,
  talentPhase,
  weaponCaps,
} from "@/domain/planner"

const MAX = { stage: { level: 90, phase: 6 }, talents: { auto: 10, skill: 10, burst: 10 } }

describe("stages", () => {
  it("lists every level and ascension a goal can name", () => {
    const names = stages(characterCaps()).map(s => `${s.level}/${s.phase}`)
    expect(names).toEqual([
      "1/0",
      "20/0",
      "20/1",
      "40/1",
      "40/2",
      "50/2",
      "50/3",
      "60/3",
      "60/4",
      "70/4",
      "70/5",
      "80/5",
      "80/6",
      "90/6",
    ])
  })

  it("stops low-rarity weapons at level 70", () => {
    expect(stages(weaponCaps(1)).at(-1)).toEqual({ level: 70, phase: 4 })
  })
})

describe("talent levels", () => {
  it("need ascensions as the game sets", () => {
    expect([0, 1, 2, 4, 6].map(talentCap)).toEqual([1, 1, 2, 6, 10])
    expect(talentPhase(9)).toBe(6)
  })
})

describe("costs", () => {
  it("adds up a 5-star from scratch to 90 and 10/10/10", () => {
    const need = characterNeed("KamisatoAyaka", START, MAX)
    expect(need.get(CHARACTER_EXP)).toBe(8_362_650)
    expect(need.get("CrownOfInsight")).toBe(3)
    // Ascensions, three talents and the Mora for EXP, 1 per 5.
    expect(need.get("Mora")).toBe(420_000 + 3 * 1_652_500 + 1_672_530)
  })

  it("costs nothing at the goal", () => {
    expect(characterNeed("KamisatoAyaka", MAX, MAX).size).toBe(0)
  })
})

describe("custom characters", () => {
  const ayaka: CustomSlots = {
    common: "FamedHandguard",
    specialty: "SakuraBloom",
    boss: "PerpetualHeart",
    gem: "ShivadaJadeGemstone",
    book: "PhilosophiesOfElegance",
    weekly: "BloodjadeBranch",
  }
  const sorted = (need: Need) => [...need].toSorted(([a], [b]) => a.localeCompare(b))

  it("cost what a released character of the same materials costs", () => {
    const custom = customNeed(ayaka, START, MAX)
    expect(sorted(custom)).toEqual(sorted(characterNeed("KamisatoAyaka", START, MAX)))
  })

  it("offer each slot's families lowest tier first", () => {
    expect(familyOptions("gem")).toHaveLength(7)
    expect(familyOptions("book").find(f => f.at(-1) === "PhilosophiesOfElegance")).toEqual([
      "TeachingsOfElegance",
      "GuideToElegance",
      "PhilosophiesOfElegance",
    ])
  })

  it("count a slot not known yet under its tier, naming no material", () => {
    const need = customNeed({ book: "PhilosophiesOfElegance" }, START, MAX)
    expect(need.get("?gem:0")).toBe(1)
    expect(need.get("?gem:3")).toBe(6)
    expect(need.get("?specialty:0")).toBe(168)
    expect(need.get("?weekly:0")).toBe(18)
    expect(need.get("PhilosophiesOfElegance")).toBe(114)
    expect(need.get("Mora")).toBe(characterNeed("KamisatoAyaka", START, MAX).get("Mora"))
    expect(unknownSlot("?gem:3")).toEqual({ of: "character", slot: "gem", tier: 3 })
    expect(unknownSlot("PhilosophiesOfElegance")).toBeUndefined()
    expect([...need.keys()].filter(isUnknown).every(key => unknownSlot(key))).toBe(true)
  })

  it("never get or combine a material not known yet, and leave the bag to later cards", () => {
    const gems = new Map([
      ["ShivadaJadeSliver", 1],
      ["ShivadaJadeFragment", 9],
    ])
    const [first, second] = allocate([customNeed({}, START, MAX), gems], gems)
    const unknown = first?.filter(l => isUnknown(l.key)) ?? []
    expect(unknown.length).toBeGreaterThan(0)
    expect(unknown.every(l => l.have === 0 && l.made === 0 && l.bag === 0)).toBe(true)
    expect(covers(first ?? [], new Map([["?gem:1", 3]]))).toBe(false)
    expect(second?.every(l => l.have === l.need)).toBe(true)
  })
})

describe("stageStep", () => {
  const caps = characterCaps()
  it("ascends at the cap", () => {
    expect(stageStep({ level: 80, phase: 5 }, { level: 90, phase: 6 }, caps)).toEqual({
      kind: "ascend",
      to: { level: 80, phase: 6 },
    })
  })

  it("levels up to the cap or to the goal", () => {
    expect(stageStep({ level: 75, phase: 5 }, { level: 90, phase: 6 }, caps)?.to).toEqual({
      level: 80,
      phase: 5,
    })
    expect(stageStep({ level: 80, phase: 6 }, { level: 90, phase: 6 }, caps)?.to).toEqual({
      level: 90,
      phase: 6,
    })
  })
})

describe("allocate", () => {
  const top = "PhilosophiesOfElegance"
  const mid = lowerTier(top) ?? ""
  const low = lowerTier(mid) ?? ""
  const need = (entries: [string, number][]): Need => new Map(entries)

  it("knows the talent book tiers", () => {
    expect([mid, low]).toEqual(["GuideToElegance", "TeachingsOfElegance"])
  })

  it("combines what is short from the tiers below, and leaves the rest to later cards", () => {
    const bag = new Map([
      [mid, 5],
      [low, 10],
      ["Mora", 10_000],
    ])
    const [first, second] = allocate([need([[top, 2]]), need([[low, 9]])], bag)
    // Six of the middle tier: the five in the bag and one made of three of the lowest,
    // at 550 Mora for each of the top tier and 175 for the middle one.
    const used = new Map([
      [mid, 5],
      [low, 3],
      ["Mora", 2 * 550 + 175],
    ])
    expect(first).toEqual([{ key: top, need: 2, have: 2, made: 2, bag: 0, used }])
    expect(second).toEqual([{ key: low, need: 9, have: 7, made: 0, bag: 7, used: new Map() }])
  })

  it("names what combining takes from two tiers down", () => {
    const [lines] = allocate(
      [need([[top, 2]])],
      new Map([
        [low, 18],
        ["Mora", 10_000],
      ]),
    )
    expect(lines?.[0]?.used).toEqual(
      new Map([
        [low, 18],
        ["Mora", 2 * 550 + 6 * 175],
      ]),
    )
  })

  it("combines only as many as the Mora left after the card's own pays for", () => {
    // 80 to 80★ takes 120,000 Mora and 6 gemstones; each gemstone combined costs 2,700.
    const gem = "ShivadaJadeGemstone"
    const chunk = lowerTier(gem) ?? ""
    const ascend = need([
      [gem, 6],
      ["Mora", 120_000],
    ])
    const made = (mora: number) => {
      const [lines] = allocate(
        [ascend],
        new Map([
          [chunk, 18],
          ["Mora", mora],
        ]),
      )
      return { made: lines?.find(l => l.key === gem)?.made, covered: covers(lines ?? [], ascend) }
    }
    expect(made(120_000)).toEqual({ made: 0, covered: false })
    expect(made(120_000 + 3 * 2_700)).toEqual({ made: 3, covered: false })
    expect(made(120_000 + 6 * 2_700)).toEqual({ made: 6, covered: true })
  })

  it("serves a card's own need of a lower tier before combining it", () => {
    const [lines] = allocate(
      [
        need([
          [mid, 3],
          [top, 1],
        ]),
      ],
      new Map([
        [mid, 5],
        ["Mora", 10_000],
      ]),
    )
    expect(lines?.find(l => l.key === mid)?.have).toBe(3)
    expect(lines?.find(l => l.key === top)?.have).toBe(0)
  })
})

describe("plannerBag", () => {
  it("counts EXP items as their EXP", () => {
    const bag = plannerBag(
      new Map([
        ["HerosWit", 2],
        ["WanderersAdvice", 3],
      ]),
    )
    expect(bag.get(CHARACTER_EXP)).toBe(43_000)
  })
})

describe("open days", () => {
  it("follows the domains' weekly turns", () => {
    const group = openGroup("TeachingsOfProsperity")
    expect(group).toBe(0)
    expect([0, 1, 2, 3, 4, 5, 6].map(day => openOn(group ?? -1, day))).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      true,
    ])
  })

  it("turns the day at 04:00 China time", () => {
    // 2026-11-22 is a Sunday; Monday starts at 04:00 on 11-23 (UTC+8).
    expect(gameWeekday(Date.UTC(2026, 10, 22, 4))).toBe(6)
    expect(gameWeekday(Date.UTC(2026, 10, 22, 19))).toBe(6)
    expect(gameWeekday(Date.UTC(2026, 10, 22, 21))).toBe(0)
  })
})
