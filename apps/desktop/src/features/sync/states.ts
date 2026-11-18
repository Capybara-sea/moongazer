// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Tone } from "@/components/StatusDot"
import type { CapturePhase, CaptureStatus } from "@/lib/backend/sync"
import { formatDuration, formatTime, formatWhen } from "@/lib/format"
import { text } from "@/text/zh"
import { leftOutText } from "./leftOut"

const t = text.sync

export const PHASE_TONE: Record<CapturePhase, Tone> = {
  off: "idle",
  starting: "warn",
  waitingGame: "warn",
  waitingLogin: "warn",
  connected: "ok",
  interrupted: "bad",
}

/** Problems that only logging in again gets past. */
const RELOGIN: readonly string[] = ["alreadyInGame", "keyLost", "switchedToCompatible"]

export function needsRelogin(status: CaptureStatus) {
  return status.problem !== null && RELOGIN.includes(status.problem.kind)
}

/**
 * Whether a login settled between two statuses. Settled goes back to false
 * whenever a login ends, also one left for another in the same game, so each
 * login settles once; a status already settled when first read is not one.
 */
export function loginSettled(before: CaptureStatus | null, after: CaptureStatus) {
  return before !== null && !before.settled && after.settled
}

/** The helper's state; each retry starts it again, which still counts as retrying. */
function helperOf(status: CaptureStatus): CaptureStatus["helper"] {
  const again = status.helper === "starting" && status.problem?.kind === "captureFailed"
  return again ? "retrying" : status.helper
}

/** What stopped an interrupted sync. */
function cause(status: CaptureStatus) {
  switch (status.problem?.kind) {
    case "helperExited":
      return t.causes.helperExited
    case "decoderStopped":
      return t.causes.decoderStopped
    case "captureFailed":
      return t.causes.captureFailed
    default:
      return t.causes.silent
  }
}

const joined = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ")

export type Card = {
  label: string
  tone: Tone
  /** How long the login has been read, while connected. */
  duration: string | null
  lines: readonly [string, string]
}

/**
 * The side menu card: the state, and two short lines on what it means.
 * `changeLines` is how many lines the changes since the login make, taken
 * together; `changedAt` is when the newest batch was read.
 */
export function cardView(
  status: CaptureStatus,
  changeLines: number,
  changedAt: number | null,
  now: number,
): Card {
  const base = { label: t.phases[status.phase], tone: PHASE_TONE[status.phase], duration: null }
  const kind = status.problem?.kind
  const helper = helperOf(status)
  switch (status.phase) {
    case "off":
      if (kind === "declined") return { ...base, lines: t.card.declined }
      if (kind === "updateFailed") return { ...base, lines: t.card.updateFailed }
      if (kind === "launchFailed" || kind === "packUnavailable") {
        return { ...base, lines: t.card.failed }
      }
      return { ...base, lines: t.card.off }
    case "starting":
      return { ...base, lines: t.card.starting }
    case "waitingGame":
      if (helper === "retrying") return { ...base, lines: t.card.retrying }
      return { ...base, lines: helper === "running" ? t.card.waitingGame : t.card.helperStarting }
    case "waitingLogin":
      if (kind === "packOutdated") return { ...base, lines: t.card.outdated }
      if (needsRelogin(status)) return { ...base, lines: t.card.relogin }
      if (helper === "retrying") return { ...base, lines: t.card.retrying }
      return { ...base, lines: t.card.waitingLogin }
    case "connected": {
      const who = joined(status.account?.nickname, status.server && t.servers[status.server])
      const what = !status.settled
        ? t.card.reading
        : changeLines > 0
          ? t.card.updated(formatWhen(changedAt ?? status.savedAt ?? now, now), changeLines)
          : t.card.synced
      return {
        ...base,
        duration: status.loginAt === null ? null : formatDuration(now - status.loginAt),
        lines: [who || t.card.entered, what],
      }
    }
    case "interrupted":
      return { ...base, lines: [cause(status), t.card.look] }
  }
}

/** The panel's line under the account. */
export function summaryText(status: CaptureStatus) {
  const helper = helperOf(status)
  switch (status.phase) {
    case "off":
      return t.summary.off
    case "starting":
      return t.summary.starting
    case "waitingGame":
      if (helper === "retrying") return t.summary.retrying
      return helper === "running" ? t.summary.waitingGame : t.summary.helperStarting
    case "waitingLogin":
      if (helper === "retrying") return t.summary.retrying
      // Until Moongazer is updated, entering Teyvat does not start sync either.
      if (status.problem?.kind === "packOutdated") return t.summary.gameRunning
      // With a problem, its note says what to do; the summary does not repeat the title screen.
      return status.problem === null ? t.summary.waitingLogin : t.summary.entering
    case "connected":
      return t.summary.connected
    case "interrupted":
      return t.summary.interrupted(
        cause(status),
        status.lostAt === null ? null : formatTime(status.lostAt),
      )
  }
}

/** What the panel says about a problem, apart from what the summary says already. */
export function problemNote(status: CaptureStatus): string | null {
  const { problem } = status
  if (problem === null || status.phase === "interrupted") return null
  switch (problem.kind) {
    case "dataOutdated":
      return t.notes.dataOutdated(leftOutText(problem.leftOut))
    case "captureFailed":
      // While retrying, the summary says so.
      return helperOf(status) === "retrying" ? null : t.notes.captureFailed
    case "helperExited":
    case "decoderStopped":
      return null
    default:
      return t.notes[problem.kind]
  }
}

export type StepLook = "done" | "wait" | "idle" | "err"
export type Step = { name: string; look: StepLook; detail: string }

const HELPER_STEP: Record<CaptureStatus["helper"], [StepLook, string]> = {
  off: ["idle", t.detail.none],
  starting: ["wait", t.detail.starting],
  running: ["done", t.detail.running],
  retrying: ["wait", t.detail.retrying],
  exited: ["err", t.detail.exited],
}

/** The four steps from the sync helper to live sync, each with its look and short text. */
export function stepsOf(status: CaptureStatus): Step[] {
  const step = (name: string, look: StepLook, detail: string): Step => ({ name, look, detail })
  const state = helperOf(status)
  const up = state === "running" || state === "retrying"
  const helper: [StepLook, string] =
    status.phase === "starting" ? ["wait", t.detail.starting] : HELPER_STEP[state]
  const game = status.server
    ? step(t.steps.game, "done", t.servers[status.server])
    : step(t.steps.game, up ? "wait" : "idle", up ? t.detail.waitGame : t.detail.none)
  const wasIn = status.phase === "interrupted" && status.loginAt !== null
  const login =
    status.entered || wasIn
      ? step(t.steps.login, "done", t.detail.entered)
      : status.server && up
        ? step(t.steps.login, "wait", t.detail.waitLogin)
        : step(t.steps.login, "idle", t.detail.none)
  let live: Step
  if (status.phase === "connected") {
    live = status.settled
      ? step(t.steps.live, "done", t.detail.syncing)
      : step(t.steps.live, "wait", t.detail.reading)
  } else if (status.phase === "interrupted") {
    const at = status.lostAt
    live = step(
      t.steps.live,
      "idle",
      at === null ? t.detail.stopped : t.detail.stoppedAt(formatTime(at)),
    )
  } else {
    live = step(t.steps.live, "idle", t.detail.none)
  }
  return [step(t.steps.helper, ...helper), game, login, live]
}

export type Action = "start" | "stop" | "restart" | "saveNow" | "openLog"

/** The panel's buttons, and the note under them. */
export function actionsOf(status: CaptureStatus): {
  primary: Action
  secondary: Action[]
  note: string | null
} {
  switch (status.phase) {
    case "off":
      return {
        primary: "start",
        secondary: status.problem?.kind === "launchFailed" ? ["openLog"] : [],
        note: t.startNote,
      }
    case "connected":
      return { primary: "saveNow", secondary: ["stop"], note: null }
    case "interrupted":
      return { primary: "restart", secondary: ["stop", "openLog"], note: null }
    default:
      return { primary: "stop", secondary: [], note: null }
  }
}

/** How long the login was read and since or until when; none before a login. */
export function connectionOf(status: CaptureStatus, now: number) {
  const { loginAt, lostAt } = status
  if (loginAt === null) return null
  if (status.phase === "connected") {
    return { value: formatDuration(now - loginAt), since: t.loggedInAt(formatTime(loginAt)) }
  }
  if (status.phase === "interrupted" && lostAt !== null) {
    return { value: formatDuration(lostAt - loginAt), since: t.lostAt(formatTime(lostAt)) }
  }
  return null
}
