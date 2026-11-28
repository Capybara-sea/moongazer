// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Artifact, Character, CharacterInfo, Weapon } from "@/domain/good"
import { text } from "@/text"
import { type CardInfo, cardInfos, traits } from "./cardInfo"

const character = (key: string): Character => ({
  key,
  level: 50,
  ascension: 2,
  constellation: 0,
  talent: { auto: 1, skill: 2, burst: 3 },
})

const weapon = (key: string, location: string, refinement = 1): Weapon => ({
  key,
  level: 1,
  ascension: 0,
  refinement,
  location,
  lock: false,
})

const artifact = (setKey: string, location: string, rarity = 5): Artifact => ({
  setKey,
  slotKey: "flower",
  level: 0,
  rarity,
  mainStatKey: "hp",
  location,
  lock: false,
  substats: [],
  unactivatedSubstats: [],
  astralMark: false,
  elixirCrafted: false,
})

const { unknown } = text.names

/** The sets on a card as name and count. */
function setsOf(info: CardInfo | undefined) {
  return info?.sets?.map(set => [set.name, set.count])
}

function infoOf(
  key: string,
  weapons: Weapon[],
  artifacts: Artifact[],
  characterInfo = new Map<string, CharacterInfo>(),
) {
  return cardInfos({ characters: [character(key)], weapons, artifacts, characterInfo }).get(key)
}

describe("cardInfos", () => {
  it("gives the talents in the order normal attack, skill, burst", () => {
    const info = infoOf("FakeHeroA", [], [])
    expect(info?.talents.map(talent => [talent.key, talent.total, talent.boosted])).toEqual([
      ["auto", 1, false],
      ["skill", 2, false],
      ["burst", 3, false],
    ])
  })

  it("takes the friendship from the character's Leyline extras", () => {
    const extras = new Map([
      ["FakeHeroA", { friendship: 8 }],
      ["FakeHeroB", { friendship: 10 }],
    ])
    expect(infoOf("FakeHeroA", [], [], extras)?.friendship).toBe(8)
  })

  it("has no friendship when the file gives none", () => {
    expect(infoOf("FakeHeroA", [], [])?.friendship).toBeUndefined()
    const joinedOnly = new Map([["FakeHeroA", { obtainedAt: 1 }]])
    expect(infoOf("FakeHeroA", [], [], joinedOnly)?.friendship).toBeUndefined()
  })

  it("finds the weapon its wielder holds and ignores the others", () => {
    const weapons = [
      weapon("FakeSpare", ""),
      weapon("FakeOther", "FakeHeroB"),
      weapon("FakeBlade", "FakeHeroA", 3),
    ]
    expect(infoOf("FakeHeroA", weapons, [])?.weapon).toEqual({
      key: "FakeBlade",
      name: unknown("FakeBlade"),
      icon: undefined,
      rarity: undefined,
      refinement: 3,
    })
  })

  it("leaves the weapon out when the character holds none", () => {
    expect(infoOf("FakeHeroA", [weapon("FakeSpare", "")], [])?.weapon).toBeUndefined()
  })

  it("gives every Traveler the gear exports file under Traveler", () => {
    const info = infoOf(
      "TravelerFake",
      [weapon("FakeBlade", "Traveler")],
      [artifact("FakeSet", "Traveler"), artifact("FakeSet", "Traveler")],
    )
    expect(info?.weapon?.name).toBe(unknown("FakeBlade"))
    expect(setsOf(info)).toEqual([[unknown("FakeSet"), 2]])
  })

  it("lists sets of two or more pieces, most pieces first", () => {
    const artifacts = [
      artifact("FakeSetB", "FakeHeroA"),
      artifact("FakeSetB", "FakeHeroA"),
      artifact("FakeSetA", "FakeHeroA"),
      artifact("FakeSetC", "FakeHeroA"),
      artifact("FakeSetA", "FakeHeroA"),
      artifact("FakeSetA", "FakeHeroA"),
      artifact("FakeSetA", "FakeHeroB"),
    ]
    expect(setsOf(infoOf("FakeHeroA", [], artifacts))).toEqual([
      [unknown("FakeSetA"), 3],
      [unknown("FakeSetB"), 2],
    ])
  })

  it("orders sets with as many pieces by name", () => {
    const artifacts = ["FakeSetB", "FakeSetA", "FakeSetB", "FakeSetA"].map(set =>
      artifact(set, "FakeHeroA"),
    )
    expect(setsOf(infoOf("FakeHeroA", [], artifacts))).toEqual([
      [unknown("FakeSetA"), 2],
      [unknown("FakeSetB"), 2],
    ])
  })

  it("gives a set the rarity of its best equipped piece", () => {
    const artifacts = [artifact("FakeSet", "FakeHeroA", 4), artifact("FakeSet", "FakeHeroA", 5)]
    expect(infoOf("FakeHeroA", [], artifacts)?.sets?.[0]?.rarity).toBe(5)
  })

  it("has no sets when no artifact is equipped", () => {
    expect(infoOf("FakeHeroA", [], [artifact("FakeSet", "")])?.sets).toBeUndefined()
  })

  it("lists no sets when no two equipped pieces share one", () => {
    const artifacts = [artifact("FakeSetA", "FakeHeroA"), artifact("FakeSetB", "FakeHeroA")]
    expect(infoOf("FakeHeroA", [], artifacts)?.sets).toEqual([])
  })
})

describe("traits", () => {
  it("gives the weapon type alone", () => {
    expect(traits({ weapon: "polearm" })).toBe(text.game.weaponTypes.polearm)
  })

  it("is empty without a weapon type", () => {
    expect(traits({})).toBe("")
  })
})
