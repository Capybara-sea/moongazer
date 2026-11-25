// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { parseAccount } from "./account"
import { SPINCRYSTAL_AREAS, SPINCRYSTALS, spincrystalView } from "./spincrystals"

const [a, b] = SPINCRYSTALS
if (!a || !b) throw new Error("the bundled table has no spincrystals")

describe("spincrystalView", () => {
  it("has the game's 214, each in an area", () => {
    expect(SPINCRYSTALS.length).toBeGreaterThanOrEqual(214)
    const areas = new Set(SPINCRYSTAL_AREAS.map(x => x.id))
    expect(SPINCRYSTALS.every(c => areas.has(c.area))).toBe(true)
  })

  it("tells placed in the realm from held in the bag", () => {
    const view = spincrystalView(
      parseAccount({
        format: "GOOD",
        materials: { [b.key]: 1 },
        gi_collections: { spincrystals: [a.id] },
      }),
    )
    expect(view.rows.find(r => r.info.id === a.id)?.status).toBe("placed")
    expect(view.rows.find(r => r.info.id === b.id)?.status).toBe("bag")
    expect([view.placed, view.bag, view.realmRead]).toEqual([1, 1, true])
  })

  it("reads the bag alone when the export lists none placed", () => {
    const view = spincrystalView(parseAccount({ format: "GOOD", materials: { [a.key]: 1 } }))
    expect([view.placed, view.bag, view.realmRead]).toEqual([0, 1, false])
  })
})
