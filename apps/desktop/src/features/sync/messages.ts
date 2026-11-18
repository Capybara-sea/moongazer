// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Snapshot } from "@/lib/backend"
import type { CaptureStatus } from "@/lib/backend/sync"
import { formatDateTime } from "@/lib/format"
import type { NewMessage } from "@/stores/messageStore"
import { text } from "@/text/zh"
import { needsRelogin, problemNote, summaryText } from "./states"

const m = text.messages

/**
 * Messages for what just went wrong: the connection broke, the player has to
 * log in again, or Moongazer has to be updated. All are "danger", so they
 * also reach a player in the game as notifications. "Has to be updated" is
 * said once per app version, or per list of what was left out, however often
 * it comes back; before the version is read, the panel alone says it.
 */
export function statusMessages(
  before: CaptureStatus | null,
  after: CaptureStatus,
  at: number,
  version: string | null,
): NewMessage[] {
  const messages: NewMessage[] = []
  if (after.phase === "interrupted" && before?.phase !== "interrupted") {
    messages.push({
      id: `sync-interrupted:${after.lostAt ?? at}`,
      kind: "danger",
      title: m.syncInterrupted,
      body: summaryText(after),
      at,
      page: "sync",
    })
  }
  const { problem } = after
  const note = problemNote(after)
  if (problem === null || note === null) return messages
  const message = (id: string, title: string): NewMessage => ({
    id,
    kind: "danger",
    title,
    body: note,
    at,
    page: "sync",
  })
  if (needsRelogin(after)) {
    if (problem.kind !== before?.problem?.kind) {
      messages.push(message(`sync-${problem.kind}:${at}`, m.syncRelogin))
    }
  } else if (problem.kind === "packOutdated" && version !== null) {
    messages.push(message(`sync-packOutdated:${version}`, m.syncOutdated))
  } else if (problem.kind === "dataOutdated") {
    messages.push(message(`sync-dataOutdated:${problem.leftOut}`, m.syncOutdated))
  }
  return messages
}

/** Asks about a snapshot auto sync saved although it looked wrong; once per snapshot. */
export function reviewMessage(snapshot: Snapshot): NewMessage {
  return {
    id: `sync-review:${snapshot.id}`,
    kind: "danger",
    title: m.syncReview,
    body: m.syncReviewBody(formatDateTime(snapshot.takenAt)),
    at: snapshot.importedAt,
    page: "overview",
  }
}
