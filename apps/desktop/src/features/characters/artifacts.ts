// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { type Artifact, SLOTS } from "@/domain/good"

/** The pieces in slot order: flower, plume, sands, goblet, circlet. */
export function bySlot(artifacts: Artifact[]) {
  return SLOTS.flatMap(slot => artifacts.filter(a => a.slotKey === slot))
}

/** The sets with two or more of the pieces, most pieces first; ties keep their order. */
export function setCounts(artifacts: Artifact[]) {
  const counts = new Map<string, number>()
  for (const { setKey } of artifacts) counts.set(setKey, (counts.get(setKey) ?? 0) + 1)
  return [...counts]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([setKey, count]) => ({ setKey, count }))
}
