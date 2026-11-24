// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { activity, activityGroup } from "./activities"

describe("activities", () => {
  it("files each type under its group", () => {
    expect(activityGroup("GCG_PVE_INFINITE")).toEqual({ group: "gcg" })
    expect(activityGroup("LEY_LINE_CHALLENGE")).toEqual({ group: "challenge" })
    expect(activityGroup("SAVE_TEYVAT")).toEqual({ group: "challenge" })
    expect(activityGroup("WEEK_ACTIVE")).toEqual({ group: "challenge" })
    expect(activityGroup("MAIN_LINE_BANNER")).toEqual({ group: "quest", tag: "quest" })
    expect(activityGroup("LIMITED_TIME_REWARD_AREA_BANNER")).toEqual({
      group: "quest",
      tag: "exploration",
    })
    expect(activityGroup("TRIAL_AVATAR")).toEqual({ group: "trial" })
    expect(activityGroup("BONUS_AVATAR_BANNER")).toEqual({ group: "banner" })
    expect(activityGroup("BEYOND_COSTUME_BANNER")).toEqual({ group: "banner" })
    expect(activityGroup("DIG_V2")).toEqual({ group: "limited" })
    expect(activityGroup(null)).toEqual({ group: "limited" })
  })

  it("names known activities and leaves unknown ones nameless", () => {
    const challenge = activity(5269)
    expect(challenge.type).toBe("LEY_LINE_CHALLENGE")
    expect(challenge.name).toEqual(expect.any(String))
    expect(activity(99_999_999)).toEqual({ name: null, type: null, group: "limited" })
  })
})
