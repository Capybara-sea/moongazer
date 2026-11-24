// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Level, UpgradeTarget } from "@/domain/today"
import { text } from "@/text/zh"

const p = text.planner
const u = text.upgrade

/** A step as the upgrade panel names it, from where it starts: ascend 80/80 to 80/90, a talent 8 to 9. */
export function targetText(target: UpgradeTarget) {
  const cap = ({ level, cap }: Level) => u.levelCap(level, cap)
  switch (target.kind) {
    case "ascend":
      return u.ascend(cap(target.from), cap(target.to))
    case "level":
      return u.level(cap(target.from), cap(target.to))
    case "talent":
      return p.talentTitle(p.talents[target.talent], target.from, target.to)
  }
}
