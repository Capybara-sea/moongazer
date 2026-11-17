// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import names from "@/generated/names.json"
import { formatStat } from "./builds"
import type { Artifact, Character, SlotKey, Substat, Weapon } from "./good"
import { characterStats, weaponStats } from "./stats"

function character(key: string, level: number, ascension: number): Character {
  return { key, level, ascension, constellation: 0, talent: { auto: 1, skill: 1, burst: 1 } }
}

function weapon(key: string, level: number, ascension: number): Weapon {
  return { key, level, ascension, refinement: 1, location: "", lock: false }
}

function artifact(
  setKey: string,
  slotKey: SlotKey,
  mainStatKey: string,
  substats: Substat[] = [],
): Artifact {
  return {
    setKey,
    slotKey,
    level: 20,
    rarity: 5,
    mainStatKey,
    location: "",
    lock: false,
    substats,
    unactivatedSubstats: [{ key: "critRate_", value: 3.9 }],
    astralMark: false,
    elixirCrafted: false,
  }
}

/** As the game shows them. */
const shown = (key: string, value: number | undefined) => formatStat(key, value ?? Number.NaN)

// Published values from the game's character and weapon pages.
describe("characterStats", () => {
  it("gives a character's base stats and ascension stat at its level and ascension", () => {
    const stats = characterStats(character("RaidenShogun", 90, 6), undefined, [])
    expect(shown("hp", stats?.hp.base)).toBe("12,907")
    expect(shown("atk", stats?.atk.base)).toBe("337")
    expect(shown("def", stats?.def.base)).toBe("789")
    expect(shown("enerRech_", stats?.enerRech_)).toBe("132.0%")
    expect(stats?.hp.total).toBe(stats?.hp.base)
    expect([stats?.critRate_, stats?.critDMG_, stats?.eleMas]).toEqual([5, 50, 0])

    const low = characterStats(character("RaidenShogun", 1, 0), undefined, [])
    expect([low?.hp.base, low?.atk.base, low?.def.base].map(v => shown("hp", v))).toEqual([
      "1,005",
      "26",
      "61",
    ])
    expect(low?.enerRech_).toBe(100)

    const xiangling = characterStats(character("Xiangling", 90, 6), undefined, [])
    expect(
      [xiangling?.hp.base, xiangling?.atk.base, xiangling?.def.base].map(v => shown("hp", v)),
    ).toEqual(["10,875", "225", "669"])
    expect(xiangling?.eleMas).toBe(96)
  })

  it("gives every Traveler the same stats", () => {
    const stats = characterStats(character("TravelerAnemo", 90, 6), undefined, [])
    expect(shown("hp", stats?.hp.base)).toBe("10,875")
    expect(shown("atk", stats?.atk.base)).toBe("212")
    expect(shown("def", stats?.def.base)).toBe("683")
    // The ascension stat is 24% ATK.
    expect(stats?.atk.total).toBeCloseTo((stats?.atk.base ?? 0) * 1.24)
    const travelers = Object.keys(names.characters).filter(key => key.startsWith("Traveler"))
    expect(travelers.length).toBeGreaterThan(5)
    for (const key of travelers) {
      expect(characterStats(character(key, 90, 6), undefined, [])).toEqual(stats)
    }
  })

  it("adds the weapon's base ATK to the character's and its substat", () => {
    const stats = characterStats(
      character("RaidenShogun", 90, 6),
      weapon("EngulfingLightning", 90, 6),
      [],
    )
    expect(shown("atk", stats?.atk.base)).toBe("945")
    expect(shown("enerRech_", stats?.enerRech_)).toBe("187.1%")
  })

  it("adds artifact main stats, substats and active 2-piece set bonuses", () => {
    const raiden = character("RaidenShogun", 90, 6)
    const base = characterStats(raiden, undefined, [])
    const stats = characterStats(raiden, undefined, [
      artifact("EmblemOfSeveredFate", "flower", "hp", [{ key: "hp_", value: 5 }]),
      artifact("EmblemOfSeveredFate", "plume", "atk", [{ key: "critDMG_", value: 7.8 }]),
      artifact("GladiatorsFinale", "sands", "enerRech_", [{ key: "atk", value: 19 }]),
      artifact("GladiatorsFinale", "goblet", "electro_dmg_"),
      artifact("ThunderingFury", "circlet", "critRate_", [{ key: "critRate_", value: 3.5 }]),
    ])
    if (!base || !stats) throw new Error("no stats for the Raiden Shogun")
    expect(stats.hp.base).toBe(base.hp.base)
    expect(stats.hp.total).toBeCloseTo(base.hp.base * 1.05 + 4780)
    // Gladiator's Finale's 2-piece bonus is 18% ATK.
    expect(stats.atk.total).toBeCloseTo(base.atk.base * 1.18 + 311 + 19)
    // Emblem of Severed Fate's is 20% Energy Recharge; one Thundering Fury piece gives nothing.
    expect(stats.enerRech_).toBeCloseTo(132 + 51.8 + 20)
    expect(stats.electro_dmg_).toBeCloseTo(46.6)
    // Unactivated substats do not count.
    expect(stats.critRate_).toBeCloseTo(5 + 31.1 + 3.5)
    expect(stats.critDMG_).toBeCloseTo(50 + 7.8)
  })

  it("counts a set's 2-piece bonus once however many pieces of it there are", () => {
    const pieces = (["flower", "plume", "sands", "goblet"] as const).map(slot =>
      artifact("EmblemOfSeveredFate", slot, slot === "plume" ? "atk" : "hp"),
    )
    const stats = characterStats(character("RaidenShogun", 90, 6), undefined, pieces)
    expect(stats?.enerRech_).toBeCloseTo(152)
  })

  it("has no stats for characters the data has no numbers for", () => {
    expect(characterStats(character("Manekin", 90, 6), undefined, [])).toBeUndefined()
    expect(characterStats(character("NoSuchFakeHero", 90, 6), undefined, [])).toBeUndefined()
  })

  it("leaves out a weapon the data lacks", () => {
    const raiden = character("RaidenShogun", 90, 6)
    const stats = characterStats(raiden, weapon("NoSuchFakeBlade", 90, 6), [])
    expect(stats?.atk.base).toBe(characterStats(raiden, undefined, [])?.atk.base)
  })
})

describe("weaponStats", () => {
  it("gives a weapon's base ATK at its level and ascension and its substat at its level", () => {
    const lightning = weaponStats(weapon("EngulfingLightning", 90, 6))
    expect(shown("atk", lightning?.atk)).toBe("608")
    expect(lightning?.sub?.key).toBe("enerRech_")
    expect(shown("enerRech_", lightning?.sub?.value)).toBe("55.1%")

    const theCatch = weaponStats(weapon("TheCatch", 90, 6))
    expect(shown("atk", theCatch?.atk)).toBe("510")
    expect(shown("enerRech_", theCatch?.sub?.value)).toBe("45.9%")

    const fresh = weaponStats(weapon("EngulfingLightning", 1, 0))
    expect(shown("atk", fresh?.atk)).toBe("46")
    expect(shown("enerRech_", fresh?.sub?.value)).toBe("12.0%")
  })

  it("has no substat for the lowest-rarity weapons and nothing for unknown keys", () => {
    expect(weaponStats(weapon("DullBlade", 1, 0))?.sub).toBeUndefined()
    expect(weaponStats(weapon("NoSuchFakeBlade", 90, 6))).toBeUndefined()
  })
})
