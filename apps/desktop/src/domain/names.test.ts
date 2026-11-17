// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import names from "@/generated/names.json"
import { text } from "@/text/zh"
import {
  characterProfile,
  characterTalents,
  constellations,
  MATERIAL_TABS,
  materialData,
  setEffects,
  unnamed,
  weaponData,
  weaponPassive,
} from "./names"

describe("constellations", () => {
  it("lists a character's six constellations with names, icons and effects, in order", () => {
    const raiden = constellations("RaidenShogun")
    expect(raiden.map(c => c.icon)).toEqual([
      "UI_Talent_S_Shougun_01",
      "UI_Talent_S_Shougun_03",
      "UI_Talent_U_Shougun_02",
      "UI_Talent_S_Shougun_02",
      "UI_Talent_U_Shougun_01",
      "UI_Talent_S_Shougun_04",
    ])
    expect(raiden.every(c => c.name.length > 0 && c.text.length > 0)).toBe(true)
    // The game's markup is gone from the effects.
    expect(raiden.some(c => /[<>{}]/.test(c.text))).toBe(false)
  })

  it("has each Traveler's own, and none for the Manekins or unknown keys", () => {
    expect(constellations("TravelerAnemo")[0]?.icon).toBe("UI_Talent_S_PlayerWind_01")
    const travelers = Object.keys(names.characters).filter(key => key.startsWith("Traveler"))
    expect(travelers.length).toBeGreaterThan(5)
    expect(travelers.every(key => constellations(key).length === 6)).toBe(true)
    expect(constellations("Manekin")).toEqual([])
    expect(constellations("NoSuchFakeHero")).toEqual([])
    expect(constellations("constructor")).toEqual([])
  })
})

describe("characterTalents", () => {
  it("has the three talents and the passive talents with the phases that unlock them", () => {
    const { talents, passives } = characterTalents("RaidenShogun")
    const three = [talents?.auto, talents?.skill, talents?.burst]
    expect(three.every(talent => talent?.name && talent.icon && talent.text)).toBe(true)
    // Her placeholder for cooking is left out.
    expect(passives.map(passive => passive.ascension)).toEqual([1, 4, 0])
  })

  it("has each Traveler's own, and none for the Manekins or unknown keys", () => {
    expect(characterTalents("TravelerAnemo").talents?.skill.name).not.toBe(
      characterTalents("TravelerGeo").talents?.skill.name,
    )
    expect(characterTalents("Manekin")).toEqual({ talents: undefined, passives: [] })
    expect(characterTalents("NoSuchFakeHero")).toEqual({ talents: undefined, passives: [] })
    expect(characterTalents("constructor")).toEqual({ talents: undefined, passives: [] })
  })
})

describe("weaponPassive", () => {
  const values = (key: string, refinement: number) =>
    weaponPassive(key, refinement)
      ?.segments.filter(s => s.highlight)
      .map(s => s.text)

  it("gives the passive at a refinement with its values marked", () => {
    expect(values("EngulfingLightning", 1)).toEqual(["28%", "80%", "30%"])
    expect(values("EngulfingLightning", 5)).toEqual(["56%", "120%", "50%"])
    expect(weaponPassive("EngulfingLightning", 1)?.name.length).toBeGreaterThan(0)
    expect(weaponData("EngulfingLightning").flavor?.length).toBeGreaterThan(0)
  })

  it("gives every refinement's value of a spot whose value changes", () => {
    const spots = weaponPassive("EngulfingLightning", 2)?.segments.filter(s => s.highlight)
    expect(spots?.[0]?.byRefinement).toEqual({
      values: ["28%", "35%", "42%", "49%", "56%"],
      current: 1,
    })
    expect(weaponPassive("KagotsurubeIsshin", 1)?.segments.some(s => s.byRefinement)).toBe(false)
  })

  it("keeps the wording of each refinement where it changes", () => {
    const plain = (refinement: number) =>
      weaponPassive("ExaiphanesBlade", refinement)
        ?.segments.filter(s => !s.highlight)
        .map(s => s.text)
        .join("")
    expect(plain(1)).not.toBe(plain(2))
    expect(plain(2)).toBe(plain(5))
  })

  it("clamps the refinement to the texts there are", () => {
    expect(values("EngulfingLightning", 0)).toEqual(values("EngulfingLightning", 1))
    expect(values("EngulfingLightning", 9)).toEqual(values("EngulfingLightning", 5))
    expect(weaponPassive("KagotsurubeIsshin", 5)).toEqual(weaponPassive("KagotsurubeIsshin", 1))
  })

  it("leaves no markup in any text", () => {
    for (const key of Object.keys(names.weapons)) {
      for (const refinement of [1, 2, 3, 4, 5]) {
        const segments = weaponPassive(key, refinement)?.segments ?? []
        expect(segments.every(s => s.text !== "" && !/<|\{\/?LINK/.test(s.text))).toBe(true)
      }
      expect(weaponData(key).flavor).not.toMatch(/</)
    }
  })

  it("has no passive for the lowest-rarity weapons or unknown keys", () => {
    expect(weaponPassive("DullBlade", 1)).toBeUndefined()
    expect(weaponPassive("NoSuchFakeBlade", 1)).toBeUndefined()
    expect(weaponPassive("constructor", 1)).toBeUndefined()
  })
})

describe("unnamed", () => {
  it("keeps only keys without a name, prototype names included", () => {
    expect(unnamed("characters", ["TravelerAnemo", "NoSuchFakeKey", "constructor"])).toEqual([
      "NoSuchFakeKey",
      "constructor",
    ])
    expect(unnamed("materials", ["Mora", "Primogem"])).toEqual([])
  })
})

describe("setEffects", () => {
  const needs = (key: string) => setEffects(key).map(effect => effect.need)

  it("lists a set's effects by the pieces they take, with their text", () => {
    expect(needs("GladiatorsFinale")).toEqual([2, 4])
    expect(needs("PrayersForWisdom")).toEqual([1])
    expect(setEffects("GladiatorsFinale").every(effect => effect.text.length > 0)).toBe(true)
  })

  it("has no effects for keys the bundled data lacks", () => {
    expect(setEffects("NoSuchFakeSet")).toEqual([])
    expect(setEffects("constructor")).toEqual([])
  })
})

describe("materialData", () => {
  it("gives a material's rarity and the game's type for it", () => {
    const mora = materialData("Mora")
    expect(mora.rarity).toBe(3)
    expect(mora.icon).toBeDefined()
    expect(mora.type).toEqual(expect.any(String))
    expect(materialData("MysticEnhancementOre").type).not.toBe(mora.type)
  })

  it("has no type for an item the game gives none, and puts it under other", () => {
    const bundle = materialData("AdventurersOreBundle")
    expect(bundle.type).toBeUndefined()
    expect(bundle.typeOrder).toBeUndefined()
    expect(bundle.tab).toBe("other")
  })

  it("gives the tab of a material's type", () => {
    expect(materialData("Mora").tab).toBe("currency")
    expect(materialData("HerosWit").tab).toBe("develop")
  })

  it("names unknown keys as data not updated", () => {
    expect(materialData("NoSuchFakeOre")).toEqual({
      name: text.names.unknown("NoSuchFakeOre"),
      rarity: undefined,
      type: undefined,
      typeOrder: undefined,
      tab: "other",
    })
  })

  it("lists the bundled types tab by tab, in the page's order, every tab with some", () => {
    const tabs = names.materialTypes.map(type => type.tab)
    expect(tabs.filter((tab, i) => tab !== tabs[i - 1])).toEqual(MATERIAL_TABS)
  })
})

describe("characterProfile", () => {
  it("gives the title, what the Vision is called and the constellation", () => {
    const raiden = characterProfile("RaidenShogun")
    expect(raiden?.title.length).toBeGreaterThan(0)
    expect(raiden?.vision.length).toBeGreaterThan(0)
    expect(raiden?.constellation.length).toBeGreaterThan(0)
    // The Raiden Shogun holds a Gnosis, not a Vision like Amber's.
    expect(raiden?.vision).not.toBe(characterProfile("Amber")?.vision)
  })

  it("gives every Traveler the twins' profile", () => {
    const anemo = characterProfile("TravelerAnemo")
    expect(anemo?.constellation.length).toBeGreaterThan(0)
    expect(characterProfile("TravelerGeo")).toEqual(anemo)
  })

  it("has none for newer keys", () => {
    expect(characterProfile("FakeHero")).toBeUndefined()
  })
})
