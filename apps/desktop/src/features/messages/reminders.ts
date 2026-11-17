// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Account } from "@/domain/account"
import { lastDailyReset } from "@/domain/gameTime"
import { theaterEnd } from "@/domain/overviewData"
import { currentWelkin, projectResin, RESIN_CAP } from "@/features/overview/daily"
import { formatMonthDay, formatNumber, formatTime } from "@/lib/format"
import type { NewMessage } from "@/stores/messageStore"
import { text } from "@/text/zh"

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** Reminders this long before a challenge resets. */
const BEFORE_RESET = 2 * DAY
/** The welkin reminder comes when this many days are left. */
const WELKIN_DAYS = 3
/** Unclaimed commission rewards are mentioned at 20:00 UTC+8, 16 hours into the game day. */
const COMMISSIONS_AFTER = 16 * HOUR
/** Realm currency this full or fuller is mentioned. */
const REALM_SHARE = 0.9
/**
 * Reminders that came due while the app was closed are recorded when it opens,
 * if they are this recent; older ones are likely out of date.
 */
export const CATCH_UP = 12 * HOUR

/**
 * What the account data says will happen, each at the time it comes due. They
 * are worked out from the snapshot taken at `takenAt`, so none is due before
 * it. Ids carry the time, so the same event from a newer snapshot is not
 * recorded twice.
 */
export function reminders(account: Account, takenAt: number): NewMessage[] {
  const t = text.messages
  const tasks = account.tasks
  const out: NewMessage[] = []
  const remind = (id: string, at: number, title: string, body: string) =>
    out.push({ id, kind: "remind", title, body, at: Math.max(at, takenAt), page: "overview" })

  const fullAt = tasks?.resin && projectResin(tasks.resin, takenAt).fullAt
  if (fullAt !== undefined && fullAt > takenAt) {
    remind(`resin:${fullAt}`, fullAt, t.resinFull, t.resinFullBody(RESIN_CAP))
  }

  const expeditions = tasks?.expeditions ?? []
  const lastDone = Math.max(...expeditions.map(e => e.doneAt))
  if (expeditions.length > 0 && lastDone > takenAt) {
    remind(
      `expeditions:${lastDone}`,
      lastDone,
      t.expeditionsDone,
      t.expeditionsDoneBody(expeditions.length),
    )
  }

  const readyAt = tasks?.transformer?.readyAt
  if (readyAt !== undefined && readyAt > takenAt) {
    remind(`transformer:${readyAt}`, readyAt, t.transformerReady, t.transformerReadyBody)
  }

  const days = tasks?.welkin?.days ?? 0
  if (days > 0) {
    // Each daily reset uses a day, so this many are left from the reset that many before the end.
    const { endsAt } = currentWelkin(days, takenAt, takenAt)
    const at = Math.max(takenAt, endsAt - WELKIN_DAYS * DAY)
    const left = Math.min(days, WELKIN_DAYS)
    remind(`welkin:${endsAt}`, at, t.welkinEnding(left), t.welkinEndingBody)
  }

  const commissions = tasks?.commissions
  if (commissions && commissions.total > 0 && commissions.finished >= commissions.total) {
    const day = lastDailyReset(takenAt)
    const at = Math.max(takenAt, day + COMMISSIONS_AFTER)
    // The next reset starts them over, so later there is nothing left to claim.
    if (!commissions.claimed && at < day + DAY) {
      remind(
        `commissions:${day}`,
        at,
        t.commissionsUnclaimed,
        t.commissionsUnclaimedBody(commissions.finished, commissions.total),
      )
    }
  }

  const realm = tasks?.realm
  if (realm && realm.limit > 0 && realm.value >= realm.limit * REALM_SHARE) {
    remind(
      `realm:${lastDailyReset(takenAt)}`,
      takenAt,
      t.realmNearlyFull,
      t.realmNearlyFullBody(formatNumber(realm.value), formatNumber(realm.limit)),
    )
  }

  const abyss = tasks?.abyss
  if (abyss && abyss.end > takenAt && abyss.stars < abyss.maxStars) {
    remind(
      `abyss:${abyss.end}`,
      abyss.end - BEFORE_RESET,
      t.abyssEnding,
      t.abyssEndingBody(abyss.stars, abyss.maxStars, when(abyss.end)),
    )
  }

  const theater = account.endgame?.theater
  const theaterEnds = theater && theaterEnd(theater.season)
  if (theater && theaterEnds !== undefined && theaterEnds > takenAt) {
    if (theater.stars < theater.maxStars) {
      remind(
        `theater:${theaterEnds}`,
        theaterEnds - BEFORE_RESET,
        t.theaterEnding,
        t.theaterEndingBody(theater.stars, theater.maxStars, when(theaterEnds)),
      )
    }
  }

  return out
}

/** Reminders to record at `now`: due, and recent enough to still mean something. */
export function dueReminders(list: readonly NewMessage[], now: number) {
  return list.filter(r => r.at <= now && r.at > now - CATCH_UP)
}

/** When the next one comes due after `now`, if any does. */
export function nextDue(list: readonly NewMessage[], now: number) {
  const later = list.map(r => r.at).filter(at => at > now)
  return later.length > 0 ? Math.min(...later) : undefined
}

function when(ms: number) {
  return `${formatMonthDay(ms)} ${formatTime(ms)}`
}
