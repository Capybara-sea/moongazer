// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { type LicenseGroup, parseFrontend, withFrontend } from "./licenses"

describe("third-party licenses", () => {
  it("reads Vite's license file and keys each text by package", () => {
    const { entries, texts } = parseFrontend([
      { name: "example-a", version: "1.0.0", identifier: "MIT", text: "MIT text A" },
      { name: "@scope/example-b", version: "2.0.0" },
    ])
    expect(entries).toEqual([
      {
        name: "example-a",
        version: "1.0.0",
        license: "MIT",
        copyright: [],
        texts: ["npm:example-a@1.0.0"],
      },
      {
        name: "@scope/example-b",
        version: "2.0.0",
        license: undefined,
        copyright: [],
        texts: [],
      },
    ])
    expect(texts).toEqual({ "npm:example-a@1.0.0": "MIT text A" })
  })

  it("refuses a license file of the wrong shape", () => {
    expect(() => parseFrontend({})).toThrow()
    expect(() => parseFrontend([{ name: "example-a" }])).toThrow()
    expect(() => parseFrontend([{ name: "example-a", version: "1.0.0", text: 1 }])).toThrow()
  })

  it("adds the bundled packages to the frontend group only, in name order", () => {
    const groups: LicenseGroup[] = [
      { id: "crates", entries: [{ name: "zeta", copyright: [], texts: [] }] },
      { id: "frontend", entries: [{ name: "tailwindcss", copyright: [], texts: ["MIT"] }] },
    ]
    const shown = withFrontend(groups, [
      { name: "react", copyright: [], texts: [] },
      { name: "@scope/pkg", copyright: [], texts: [] },
    ])
    expect(shown.map(group => group.entries.map(entry => entry.name))).toEqual([
      ["zeta"],
      ["@scope/pkg", "react", "tailwindcss"],
    ])
    expect(groups[1]?.entries).toHaveLength(1)
  })
})
