// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import iconSvg from "@logo/icon.svg?raw"
import logoSvg from "@logo/logo.svg?raw"
import { describe, expect, it } from "vitest"
import { scopeSvgIds } from "./scopeSvg"

describe("scopeSvgIds", () => {
  it.each([
    ["logo", logoSvg],
    ["icon", iconSvg],
  ])("scopes every id in %s.svg and every reference still finds its target", (_, svg) => {
    const scoped = scopeSvgIds(svg, "s")
    const ids = [...scoped.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])
    const refs = [...scoped.matchAll(/(?:url\(#|href="#)([^")]+)/g)].map(m => m[1])

    expect(ids.length).toBeGreaterThan(0)
    expect(ids.filter(id => !id?.startsWith("s-"))).toEqual([])
    expect(refs.length).toBeGreaterThan(0)
    expect(refs.filter(ref => !ids.includes(ref))).toEqual([])
  })
})
