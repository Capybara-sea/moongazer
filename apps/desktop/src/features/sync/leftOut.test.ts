// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { text } from "@/i18n"
import { leftOutText } from "./leftOut"

const l = text.sync.leftOut

describe("leftOutText", () => {
  it("names each kind left out with its count", () => {
    expect(leftOutText("unknown_weapon: 2, unknown_material: 7")).toBe(
      text.sync.leftOutList([l.weapons(2), l.materials(7)]),
    )
    expect(leftOutText("saturated_currency: 1")).toBe(text.sync.leftOutList([l.currencies(1)]))
  })

  it("sums reasons of one kind and lists the kinds in a fixed order", () => {
    const leftOut =
      "character_invalid_level: 1, character_missing_ascension: 2, unknown_artifact: 3, " +
      "unknown_character: 1, unknown_material: 4, unnamed_material: 5"
    expect(leftOutText(leftOut)).toBe(
      text.sync.leftOutList([l.characters(1), l.artifacts(3), l.materials(9), l.characterData(3)]),
    )
  })

  it("counts unknown reasons as other and skips what is not a count", () => {
    expect(leftOutText("unknown_thing: 2, new_reason: 1, garbled, : 3")).toBe(
      text.sync.leftOutList([l.other(3)]),
    )
    expect(leftOutText("")).toBe("")
    expect(leftOutText("constructor: 1")).toBe(text.sync.leftOutList([l.other(1)]))
  })
})
