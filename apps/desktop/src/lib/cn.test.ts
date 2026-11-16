// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { cn } from "./cn"

describe("cn", () => {
  it("lets the later conflicting class win and skips falsy values", () => {
    const disabled = false
    expect(cn("px-2 text-sm", disabled && "hidden", "px-4")).toBe("text-sm px-4")
  })
})
