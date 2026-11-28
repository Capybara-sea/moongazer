// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { lookup } from "@/domain/names"
import type { Batch, Changed } from "@/lib/backend/sync"
import type { Labeled, Way } from "@/lib/format"
import { text } from "@/text"
import { changeLines, changeRows, mergeChanges } from "./changes"

const c = text.sync.change
const d = text.characterDetail
const name = (kind: "characters" | "weapons" | "artifactSets" | "materials", key: string) =>
  lookup(kind, key).name
const change = (
  path: string[],
  before: unknown,
  after: unknown,
  key: string | null = null,
): Changed => ({
  path,
  before,
  after,
  key,
})
const line = (label: string, delta?: string, way: Way = "gain"): Labeled => ({
  label,
  change: delta === undefined ? null : { text: delta, way },
})
const to = (n: number) => text.number.movedTo(n)
const hero = (patch: Record<string, unknown> = {}) => ({
  key: "FakeHero",
  level: 80,
  ascension: 5,
  constellation: 0,
  talent: { auto: 1, skill: 6, burst: 9 },
  ...patch,
})

describe("changeLines", () => {
  it("signs material counts, lists currencies first and marks gains and losses", () => {
    const lines = changeLines([
      change(["materials", "FakeOre"], 10, 4),
      change(["materials", "Mora"], 100, 12_500),
      change(["materials", "Primogem"], null, 60),
      change(["materials", "FakeGem"], 3, 3),
    ])
    expect(lines).toEqual([
      line(name("materials", "Primogem"), "+60"),
      line(name("materials", "Mora"), "+12,400"),
      line(name("materials", "FakeOre"), "-6", "loss"),
    ])
  })

  it("names character fields, talents and new characters, with the new value apart", () => {
    const hero2 = name("characters", "FakeHero")
    const lines = changeLines([
      change(["characters", "FakeHero", "level"], 80, 90),
      change(["characters", "FakeHero", "talent", "burst"], 10, 9),
      change(["characters", "FakeHero", "talent", "skill"], null, 7),
      change(["characters", "FakeNew"], null, hero({ key: "FakeNew" })),
    ])
    expect(lines).toEqual([
      line(c.named(hero2, d.changedFrom(d.level, 80)), to(90)),
      line(c.named(hero2, d.changedFrom(text.game.talents.burst, 10)), to(9), "loss"),
      line(c.named(hero2, text.game.talents.skill), to(7)),
      line(c.gained(name("characters", "FakeNew"), 1)),
    ])
  })

  it("compares a character replaced as a whole field by field", () => {
    const before = hero()
    const after = hero({ constellation: 1, talent: { auto: 1, skill: 7, burst: 9 }, extra: true })
    const hero2 = name("characters", "FakeHero")
    expect(changeLines([change(["characters", "FakeHero"], before, after)])).toEqual([
      line(c.named(hero2, d.changedFrom(d.constellation, 0)), to(1)),
      line(c.named(hero2, d.changedFrom(text.game.talents.skill, 6)), to(7)),
    ])
  })

  it("names weapons gained and used", () => {
    const blade = { key: "FakeBlade", level: 1 }
    const lines = changeLines([
      change(["weapons", "1"], null, blade),
      change(["weapons", "2"], null, blade),
      change(["weapons", "3"], blade, null),
    ])
    expect(lines).toEqual([
      line(c.gained(name("weapons", "FakeBlade"), 2)),
      line(c.used(name("weapons", "FakeBlade"), 1)),
    ])
  })

  it("names a weapon's raised fields by the key the change carries", () => {
    const blade = name("weapons", "FakeBlade")
    const lines = changeLines([
      change(["weapons", "4", "level"], 80, 90, "FakeBlade"),
      change(["weapons", "4", "ascension"], 5, 6, "FakeBlade"),
      change(["weapons", "5", "refinement"], 1, 2, "FakeBlade"),
      change(["weapons", "6", "location"], "", "FakeHero", "FakeBlade"),
    ])
    expect(lines).toEqual([
      line(c.named(blade, d.changedFrom(d.level, 80)), to(90)),
      line(c.named(blade, d.changedFrom(d.ascension, 5)), to(6)),
      line(c.named(blade, d.changedFrom(d.refinement, 1)), to(2)),
    ])
  })

  it("counts artifacts and leaves the rest out", () => {
    const piece = { setKey: "FakeSet", rarity: 5, level: 0 }
    const lines = changeLines([
      change(["artifacts", "1"], null, piece),
      change(["artifacts", "2"], null, piece),
      change(["artifacts", "3"], piece, null),
      change(["artifacts", "4", "lock"], false, true, "FakeSet"),
      change(["gi_player", "ar"], 59, 60),
      change(["gi_quests", "100"], 0, 1),
    ])
    expect(lines).toEqual([line(c.artifactsGained(2)), line(c.artifactsUsed(1))])
  })

  it("names a leveled artifact by its set when the change carries it", () => {
    const set = name("artifactSets", "FakeSet")
    const lines = changeLines([
      change(["artifacts", "4", "level"], 16, 20, "FakeSet"),
      change(["artifacts", "4", "lock"], false, true, "FakeSet"),
    ])
    expect(lines).toEqual([line(c.named(set, d.changedFrom(c.artifactLevel, 16)), to(20))])
  })

  it("counts the achievement ids added to the list", () => {
    expect(changeLines([change(["gi_achievements"], [1, 2], [2, 1, 3, 4])])).toEqual([
      line(c.achievements(2)),
    ])
    expect(changeLines([change(["gi_achievements"], null, [5])])).toEqual([line(c.achievements(1))])
    expect(changeLines([change(["gi_achievements"], [1, 2], [2, 1])])).toEqual([])
    expect(changeLines([change(["gi_achievement_times", "3"], null, 1_700_000_000)])).toEqual([])
  })
})

const mora = (before: number, after: number) => change(["materials", "Mora"], before, after)
const batch = (at: number, ...changes: Changed[]): Batch => ({ at, changes })
/** 21:04:00 local time on a fake day. */
const AT = new Date(2026, 10, 15, 21, 4).getTime()

describe("mergeChanges", () => {
  it("keeps a path's first value before and last value after", () => {
    const merged = mergeChanges([
      batch(1, mora(100, 200), change(["materials", "FakeOre"], 5, 4)),
      batch(2, mora(200, 350)),
    ])
    expect(merged).toEqual([mora(100, 350), change(["materials", "FakeOre"], 5, 4)])
  })

  it("leaves out a path that ended where it began", () => {
    const weapon = { key: "FakeBlade", level: 1 }
    const merged = mergeChanges([
      batch(1, mora(100, 200), change(["weapons", "7"], null, weapon)),
      batch(2, mora(200, 100), change(["weapons", "7"], weapon, null)),
    ])
    expect(merged).toEqual([])
  })

  it("forgets the field changes of an item gained, leveled and fed in between", () => {
    const piece = (level: number) => ({ setKey: "FakeSet", rarity: 5, level })
    const merged = mergeChanges([
      batch(1, change(["artifacts", "1"], null, piece(0))),
      batch(2, change(["artifacts", "1", "level"], 0, 4)),
      batch(
        3,
        change(["artifacts", "1"], piece(4), null),
        change(["artifacts", "2", "level"], 8, 12, "FakeSet"),
      ),
    ])
    expect(merged).toEqual([change(["artifacts", "2", "level"], 8, 12, "FakeSet")])
    const set = name("artifactSets", "FakeSet")
    expect(changeLines(merged)).toEqual([
      line(c.named(set, d.changedFrom(c.artifactLevel, 8)), to(12)),
    ])
  })

  it("takes a field's earlier value back into an item changed whole later", () => {
    const blade = (level: number) => ({ key: "FakeBlade", level })
    const merged = mergeChanges([
      batch(
        1,
        change(["weapons", "1", "level"], 1, 20),
        change(["characters", "FakeHero", "level"], 70, 80),
      ),
      batch(2, change(["weapons", "1"], blade(20), null)),
      batch(3, change(["characters", "FakeHero"], hero({ extra: 1 }), hero({ extra: 2 }))),
    ])
    expect(merged).toEqual([
      change(["weapons", "1"], blade(1), null),
      change(["characters", "FakeHero"], hero({ level: 70, extra: 1 }), hero({ extra: 2 })),
    ])
  })

  it("puts a gained item's later field changes into it", () => {
    const blade = (level: number) => ({ key: "FakeBlade", level })
    const merged = mergeChanges([
      batch(1, change(["weapons", "1"], null, blade(1))),
      batch(2, change(["weapons", "1", "level"], 1, 20)),
    ])
    expect(merged).toEqual([change(["weapons", "1"], null, blade(20))])
    expect(changeLines(merged)).toEqual([line(c.gained(name("weapons", "FakeBlade"), 1))])
  })
})

describe("changeRows", () => {
  it("gives one row a second, newest first, each second's batches merged", () => {
    const rows = changeRows([
      batch(AT, mora(100, 200)),
      batch(AT + 400, mora(200, 300)),
      batch(AT + 15_000, mora(300, 250)),
    ])
    const moraName = name("materials", "Mora")
    expect(rows).toEqual([
      {
        second: Math.floor((AT + 15_000) / 1000),
        time: "21:04:15",
        lines: [line(moraName, "-50", "loss")],
      },
      { second: Math.floor(AT / 1000), time: "21:04:00", lines: [line(moraName, "+200")] },
    ])
  })

  it("leaves out a second whose changes cancel out or are not named", () => {
    const rows = changeRows([
      batch(AT, mora(100, 200)),
      batch(AT + 500, mora(200, 100)),
      batch(AT + 15_000, change(["quests", "100"], 0, 1)),
    ])
    expect(rows).toEqual([])
  })
})
