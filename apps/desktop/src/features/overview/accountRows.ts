// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Account } from "@/domain/account"
import { formatNumber } from "@/lib/format"
import { text } from "@/text"

const shown = (n: number | undefined) => (n === undefined ? text.number.missing : formatNumber(n))

/** The values of the account card's six rows; missing ones show as a dash. */
export function accountStats(account: Account) {
  const { player } = account
  const stars = account.tasks?.abyss?.stars
  const birthday = player?.birthday
  return {
    ar: shown(player?.ar),
    wl: shown(player?.wl),
    achievements: shown(account.achievements?.done.size),
    maxFriendship: shown(account.maxFriendship),
    abyss: stars === undefined ? text.number.missing : text.account.abyssStars(stars),
    birthday: birthday
      ? text.account.birthdayValue(birthday.month, birthday.day)
      : text.number.missing,
  }
}
