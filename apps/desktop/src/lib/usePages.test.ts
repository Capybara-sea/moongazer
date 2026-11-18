// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { pageItems } from "./usePages"

describe("pageItems", () => {
  it("shows every page when there are few", () => {
    expect(pageItems(0, 1)).toEqual([0])
    expect(pageItems(2, 5)).toEqual([0, 1, 2, 3, 4])
  })

  it("keeps the ends and the current page's neighbours, with gaps between", () => {
    expect(pageItems(0, 35)).toEqual([0, 1, "gap", 34])
    expect(pageItems(10, 35)).toEqual([0, "gap", 9, 10, 11, "gap", 34])
    expect(pageItems(34, 35)).toEqual([0, "gap", 33, 34])
  })

  it("shows a page rather than a gap standing for it alone", () => {
    expect(pageItems(3, 35)).toEqual([0, 1, 2, 3, 4, "gap", 34])
    expect(pageItems(31, 35)).toEqual([0, "gap", 30, 31, 32, 33, 34])
  })
})
