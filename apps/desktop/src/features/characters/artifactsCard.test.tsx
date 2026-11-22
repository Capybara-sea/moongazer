// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Artifact, SlotKey } from "@/domain/good"
import { ArtifactsCard } from "./ArtifactsCard"

const piece = (slotKey: SlotKey, rarity: number): Artifact => ({
  setKey: "FakeSet",
  slotKey,
  level: 20,
  rarity,
  mainStatKey: "hp",
  location: "FakeHero",
  lock: false,
  substats: [],
  unactivatedSubstats: [],
  astralMark: false,
  elixirCrafted: false,
})

describe("ArtifactsCard", () => {
  it("boxes each piece's icon in the colors of its rarity", () => {
    const html = renderToStaticMarkup(
      <ArtifactsCard artifacts={[piece("flower", 5), piece("plume", 4)]} />,
    )
    expect(html).toContain("from-(--rarity-5-from)")
    expect(html).toContain("from-(--rarity-4-from)")
  })
})
