// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Account } from "@/domain/account"
import { type TalentKey, wielderKey } from "@/domain/builds"
import { type Artifact, SLOTS, type SlotKey, type Substat, type Weapon } from "@/domain/good"
import { lookup } from "@/domain/names"
import { type Labeled, movedTo } from "@/lib/format"
import { text } from "@/text/zh"

const t = text.characterDetail
const TALENTS: readonly TalentKey[] = ["auto", "skill", "burst"]
const plain = (label: string): Labeled => ({ label, change: null })

/** What changed for one character since the previous snapshot, one line each. */
export function characterChanges(current: Account, previous: Account, key: string): Labeled[] {
  const now = current.characters.find(c => c.key === key)
  if (!now) return []
  // Leyline names the Traveler after their current element, so after a switch
  // the previous snapshot has them under another key. Level, ascension and gear
  // are shared by every element; constellations and talents are not.
  const at = wielderKey(key)
  const before =
    previous.characters.find(c => c.key === key) ??
    previous.characters.find(c => wielderKey(c.key) === at)
  if (!before) return [plain(t.joinedNow)]
  const lines: Labeled[] = []
  const compare = (label: string, from: number, to: number) => {
    if (from !== to) lines.push({ label: t.changedFrom(label, from), change: movedTo(from, to) })
  }
  compare(t.level, before.level, now.level)
  compare(t.ascension, before.ascension, now.ascension)
  if (before.key === key) {
    compare(t.constellation, before.constellation, now.constellation)
    for (const talent of TALENTS) {
      compare(text.game.talents[talent], before.talent[talent], now.talent[talent])
    }
  }
  const was = previous.characterInfo.get(key)?.friendship
  const is = current.characterInfo.get(key)?.friendship
  if (was !== undefined && is !== undefined) compare(t.friendship, was, is)

  const weaponBefore = weaponOf(previous, key)
  const weaponNow = weaponOf(current, key)
  if (weaponBefore && weaponNow && weaponBefore.key === weaponNow.key) {
    compare(t.weaponLevel, weaponBefore.level, weaponNow.level)
    compare(t.refinement, weaponBefore.refinement, weaponNow.refinement)
  } else if (weaponNow) {
    const name = lookup("weapons", weaponNow.key).name
    lines.push(plain(weaponBefore ? t.weaponSwapped(name) : t.equipped(name)))
  } else if (weaponBefore) {
    lines.push(plain(t.unequipped(t.weapon)))
  }

  for (const slot of SLOTS) {
    const line = artifactChange(
      slot,
      artifactOf(previous, key, slot),
      artifactOf(current, key, slot),
    )
    if (line) lines.push(plain(line))
  }
  return lines
}

/** The weapon a character holds, the highest level one if an export lists several. */
function weaponOf(account: Account, key: string) {
  const at = wielderKey(key)
  return account.weapons.reduce<Weapon | undefined>(
    (best, weapon) =>
      weapon.location === at && (!best || weapon.level > best.level) ? weapon : best,
    undefined,
  )
}

function artifactOf(account: Account, key: string, slot: SlotKey) {
  const at = wielderKey(key)
  return account.artifacts.find(a => a.location === at && a.slotKey === slot)
}

function sameStats(a: Substat[], b: Substat[]) {
  return a.length === b.length && a.every((s, i) => s.key === b[i]?.key && s.value === b[i]?.value)
}

/**
 * Exports carry no item ids, so a piece is told apart by its content only:
 * leveling one up keeps its set, main stat and rarity.
 */
function artifactChange(slot: SlotKey, before?: Artifact, now?: Artifact) {
  const name = text.game.slots[slot]
  if (!before) return now && t.equipped(name)
  if (!now) return t.unequipped(name)
  const kept =
    before.setKey === now.setKey &&
    before.mainStatKey === now.mainStatKey &&
    before.rarity === now.rarity
  if (kept && now.level > before.level) return t.upgraded(name, now.level)
  const same =
    kept &&
    now.level === before.level &&
    sameStats(before.substats, now.substats) &&
    sameStats(before.unactivatedSubstats, now.unactivatedSubstats)
  return same ? undefined : t.replaced(name)
}
