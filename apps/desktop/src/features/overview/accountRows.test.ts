// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import type { Account } from "@/domain/account"
import { text } from "@/text/zh"
import { accountStats, maskUid } from "./accountRows"

describe("maskUid", () => {
  it("keeps the first digit and hides each other digit", () => {
    expect(maskUid(987654321)).toBe("9••••••••")
    expect(maskUid(5)).toBe("5")
  })
})

/** The GOOD lists, which these rows do not read. */
const lists = {
  characters: [],
  weapons: [],
  artifacts: [],
  materials: new Map(),
  characterInfo: new Map(),
}

describe("accountStats", () => {
  it("formats every row of a complete account", () => {
    const account: Account = {
      ...lists,
      leyline: true,
      player: { ar: 60, wl: 9, birthday: { month: 6, day: 1 } },
      achievements: 1412,
      maxFriendship: 72,
      tasks: { abyss: { start: 0, end: 1, stars: 36, maxStars: 36 } },
    }
    expect(accountStats(account)).toEqual({
      ar: "60",
      wl: "9",
      achievements: "1,412",
      maxFriendship: "72",
      abyss: text.account.abyssStars(36),
      birthday: text.account.birthdayValue(6, 1),
    })
  })

  it("shows a dash for each value the export left out", () => {
    const missing = text.number.missing
    expect(accountStats({ ...lists, leyline: true })).toEqual({
      ar: missing,
      wl: missing,
      achievements: missing,
      maxFriendship: missing,
      abyss: missing,
      birthday: missing,
    })
  })

  it("shows zero counts as numbers, not as missing", () => {
    const stats = accountStats({ ...lists, leyline: true, achievements: 0, maxFriendship: 0 })
    expect(stats.achievements).toBe("0")
    expect(stats.maxFriendship).toBe("0")
  })
})
