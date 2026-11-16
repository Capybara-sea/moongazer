// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { unnamed } from "./names"

describe("unnamed", () => {
  it("keeps only keys without a name, prototype names included", () => {
    expect(unnamed("characters", ["TravelerAnemo", "NoSuchFakeKey", "constructor"])).toEqual([
      "NoSuchFakeKey",
      "constructor",
    ])
    expect(unnamed("materials", ["Mora", "Primogem"])).toEqual([])
  })
})
