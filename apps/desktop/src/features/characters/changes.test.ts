// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import type { Artifact, Character, Weapon } from "@/domain/good"
import { lookup } from "@/domain/names"
import { text } from "@/i18n"
import { type Labeled, movedTo } from "@/lib/format"
import { characterChanges } from "./changes"

const t = text.characterDetail
const slots = text.game.slots
const plain = (label: string): Labeled => ({ label, change: null })
const moved = (label: string, from: number, to: number): Labeled => ({
  label: t.changedFrom(label, from),
  change: movedTo(from, to),
})

const character = (patch: Partial<Character> = {}): Character => ({
  key: "FakeHero",
  level: 70,
  ascension: 4,
  constellation: 0,
  talent: { auto: 1, skill: 6, burst: 9 },
  ...patch,
})

const weapon = (patch: Partial<Weapon> = {}): Weapon => ({
  key: "FakeBlade",
  level: 80,
  ascension: 5,
  refinement: 1,
  location: "FakeHero",
  lock: false,
  ...patch,
})

const artifact = (patch: Partial<Artifact> = {}): Artifact => ({
  setKey: "FakeSet",
  slotKey: "flower",
  level: 16,
  rarity: 5,
  mainStatKey: "hp",
  location: "FakeHero",
  lock: false,
  substats: [{ key: "critRate_", value: 3.9 }],
  unactivatedSubstats: [],
  astralMark: false,
  elixirCrafted: false,
  ...patch,
})

const account = (parts: Partial<Account> = {}): Account => ({
  characters: [character()],
  weapons: [weapon()],
  artifacts: [artifact()],
  materials: new Map(),
  characterInfo: new Map(),
  ...parts,
})

const blade = lookup("weapons", "FakeBlade").name

describe("characterChanges", () => {
  it("lists nothing when the character did not change", () => {
    expect(characterChanges(account(), account(), "FakeHero")).toEqual([])
  })

  it("says only that the character is new when the previous snapshot lacks it", () => {
    const now = account({ characters: [character({ level: 90 })] })
    expect(characterChanges(now, account({ characters: [] }), "FakeHero")).toEqual([
      plain(t.joinedNow),
    ])
  })

  it("lists level, ascension, constellation and base talent levels in that order", () => {
    const now = account({
      characters: [
        character({
          level: 80,
          ascension: 5,
          constellation: 2,
          talent: { auto: 1, skill: 7, burst: 10 },
        }),
      ],
    })
    expect(characterChanges(now, account(), "FakeHero")).toEqual([
      moved(t.level, 70, 80),
      moved(t.ascension, 4, 5),
      moved(t.constellation, 0, 2),
      moved(text.game.talents.skill, 6, 7),
      moved(text.game.talents.burst, 9, 10),
    ])
  })

  it("compares friendship only when both snapshots know it", () => {
    const known = (friendship: number) => new Map([["FakeHero", { friendship }]])
    const now = account({ characterInfo: known(8) })
    expect(characterChanges(now, account({ characterInfo: known(7) }), "FakeHero")).toEqual([
      moved(t.friendship, 7, 8),
    ])
    expect(characterChanges(now, account(), "FakeHero")).toEqual([])
  })

  it("reports the weapon's level and refinement when it is the same weapon", () => {
    const now = account({ weapons: [weapon({ level: 90, refinement: 2 })] })
    expect(characterChanges(now, account(), "FakeHero")).toEqual([
      moved(t.weaponLevel, 80, 90),
      moved(t.refinement, 1, 2),
    ])
  })

  it("reports a swapped, newly equipped or removed weapon", () => {
    const other = account({ weapons: [weapon({ key: "FakeBow" })] })
    const none = account({ weapons: [weapon({ location: "" })] })
    expect(characterChanges(account(), other, "FakeHero")).toEqual([plain(t.weaponSwapped(blade))])
    expect(characterChanges(account(), none, "FakeHero")).toEqual([plain(t.equipped(blade))])
    expect(characterChanges(none, account(), "FakeHero")).toEqual([plain(t.unequipped(t.weapon))])
  })

  it("takes the highest level weapon when several share the character", () => {
    const now = account({ weapons: [weapon({ key: "FakeBow", level: 20 }), weapon()] })
    expect(characterChanges(now, account(), "FakeHero")).toEqual([])
  })

  it("finds a Traveler's weapon and artifacts under the shared Traveler location", () => {
    const traveler = (level: number) =>
      account({
        characters: [character({ key: "TravelerFake" })],
        weapons: [weapon({ location: "Traveler", level })],
        artifacts: [artifact({ location: "Traveler" })],
      })
    expect(characterChanges(traveler(90), traveler(80), "TravelerFake")).toEqual([
      moved(t.weaponLevel, 80, 90),
    ])
  })

  it("compares a Traveler who switched elements on level, ascension and gear only", () => {
    const traveler = (key: string, patch: Partial<Character>, level: number) =>
      account({
        characters: [character({ key, ...patch })],
        weapons: [weapon({ location: "Traveler", level })],
        artifacts: [artifact({ location: "Traveler" })],
      })
    const before = traveler("TravelerFakeWind", { level: 80, constellation: 6 }, 80)
    const now = traveler(
      "TravelerFakeRock",
      { level: 90, talent: { auto: 1, skill: 1, burst: 1 } },
      90,
    )
    expect(characterChanges(now, before, "TravelerFakeRock")).toEqual([
      moved(t.level, 80, 90),
      moved(t.weaponLevel, 80, 90),
    ])
  })

  it("reports artifacts equipped and removed per slot, in slot order", () => {
    const now = account({ artifacts: [artifact({ slotKey: "circlet" }), artifact()] })
    const before = account({ artifacts: [artifact(), artifact({ slotKey: "plume" })] })
    expect(characterChanges(now, before, "FakeHero")).toEqual([
      plain(t.unequipped(slots.plume)),
      plain(t.equipped(slots.circlet)),
    ])
  })

  it("reads a higher level piece of the same set, main stat and rarity as an upgrade", () => {
    const now = account({
      artifacts: [artifact({ level: 20, substats: [{ key: "critRate_", value: 7.0 }] })],
    })
    expect(characterChanges(now, account(), "FakeHero")).toEqual([
      plain(t.upgraded(slots.flower, 20)),
    ])
  })

  it("reads any other difference as a new piece", () => {
    const changed = (patch: Partial<Artifact>) =>
      characterChanges(account({ artifacts: [artifact(patch)] }), account(), "FakeHero")
    expect(changed({ setKey: "OtherFakeSet", level: 20 })).toEqual([
      plain(t.replaced(slots.flower)),
    ])
    expect(changed({ mainStatKey: "atk" })).toEqual([plain(t.replaced(slots.flower))])
    expect(changed({ level: 12 })).toEqual([plain(t.replaced(slots.flower))])
    expect(changed({ substats: [{ key: "critDMG_", value: 7.8 }] })).toEqual([
      plain(t.replaced(slots.flower)),
    ])
    expect(changed({ unactivatedSubstats: [{ key: "atk", value: 19 }] })).toEqual([
      plain(t.replaced(slots.flower)),
    ])
  })
})
