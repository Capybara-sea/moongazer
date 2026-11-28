// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { text } from "@/text"
import { targetText } from "./upgradeText"

const p = text.planner
const u = text.upgrade

describe("the upgrade panel", () => {
  it("names ascending, levelling and talent steps from where they start", () => {
    const from = { level: 80, cap: 80 }
    const to = { level: 80, cap: 90 }
    expect(targetText({ kind: "ascend", from, to })).toBe(u.ascend("80/80", "80/90"))
    const levelled = { kind: "level", from: to, to: { level: 90, cap: 90 } } as const
    expect(targetText(levelled)).toBe(u.level("80/90", "90/90"))
    expect(targetText({ kind: "talent", talent: "skill", from: 8, to: 9 })).toBe(
      p.talentTitle(p.talents.skill, 8, 9),
    )
  })
})
