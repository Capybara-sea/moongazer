// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { Check, ChevronRight, TriangleAlert, X } from "lucide-react"
import { LabeledList } from "@/components/Delta"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { StatusDot, TONE_SOFT } from "@/components/StatusDot"
import { UidLine } from "@/components/UidLine"
import { changeRows } from "@/domain/changes"
import type { CaptureStatus } from "@/lib/backend/sync"
import { cn } from "@/lib/cn"
import { formatTime } from "@/lib/format"
import { navigate } from "@/lib/route"
import { useAccountStore } from "@/stores/accountStore"
import { useAppearanceStore } from "@/stores/appearanceStore"
import { useCaptureStore } from "@/stores/captureStore"
import { text } from "@/text/zh"
import {
  type Action,
  actionsOf,
  connectionOf,
  PHASE_TONE,
  problemNote,
  type Step,
  type StepLook,
  stepsOf,
  summaryText,
} from "./states"

const t = text.sync
/** Rows of changes shown before "N more". */
const SHOWN_ROWS = 8

const close = () => useCaptureStore.getState().setPanelOpen(false)

/**
 * The connection panel: who is connected, the four steps, recent changes and
 * what to do. `now` is the card's clock, so both show the same duration.
 */
export function SyncPanel({ now }: { now: number }) {
  const status = useCaptureStore(s => s.status)
  const error = useCaptureStore(s => s.error)
  if (!status) return null
  const tone = PHASE_TONE[status.phase]
  const note = problemNote(status)
  const withAccount = status.phase === "connected" || status.phase === "interrupted"
  return (
    <div className="flex flex-col gap-3.5 p-[18px]">
      <div className="flex items-center gap-2.5">
        <h2 className="font-semibold text-[17px]">{t.title}</h2>
        <StatusDot
          tone={tone}
          className={cn(
            "rounded-full px-2.5 py-0.5 font-semibold text-[12px] transition-colors duration-200",
            TONE_SOFT[tone],
          )}
        >
          {t.phases[status.phase]}
        </StatusDot>
      </div>
      {withAccount && status.account && <AccountBlock status={status} now={now} />}
      <p key={summaryText(status)} data-rise className="text-[13px] text-muted">
        {summaryText(status)}
      </p>
      <ol className="flex flex-col">
        {stepsOf(status).map(step => (
          <StepRow key={step.name} step={step} />
        ))}
      </ol>
      {note && (
        <div
          role="note"
          data-rise
          className="flex gap-2.5 rounded-[10px] border border-(--warn) px-3 py-2.5 text-[12px]"
        >
          <TriangleAlert aria-hidden className="mt-px size-4 flex-none text-(--warn)" />
          <span className="select-text">{note}</span>
        </div>
      )}
      {status.phase === "connected" && <Changes savedAt={status.savedAt} />}
      <Actions status={status} />
      {error && (
        <p className="select-text text-[12px] text-danger">
          {t.failed}: {error}
        </p>
      )}
    </div>
  )
}

/** Avatar, name, UID, server and rank, with how long the login has been read. */
function AccountBlock({ status, now }: { status: CaptureStatus; now: number }) {
  const maskUid = useAppearanceStore(s => s.maskUid)
  const { account, server } = status
  // As the side menu has it: known once one of the account's exports is read.
  const face = useAccountStore(s => {
    const group = s.accounts.find(g => account?.uid != null && g.uid === account.uid)
    return group && s.faces[group.token]
  })
  if (!account) return null
  const connection = connectionOf(status, now)
  const extras = [
    server && t.servers[server],
    account.adventureRank !== null && t.adventureRank(account.adventureRank),
  ].filter(part => typeof part === "string")
  return (
    <div className="glass-inset flex items-center gap-3 rounded-[12px] bg-surface-secondary px-3.5 py-3">
      <ProfileAvatar
        picture={face?.picture}
        frame={face?.frame}
        label={account.nickname ?? ""}
        size="medium"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold text-sm">
          {account.nickname ?? text.number.missing}
        </span>
        <UidLine
          // A new default masks or shows the UID again.
          key={String(maskUid)}
          uid={account.uid ?? undefined}
          masked={maskUid}
          className="flex-wrap gap-1 text-[12px] text-muted"
          buttonClassName="size-[22px]"
        >
          {extras.map(part => (
            <span key={part}>· {part}</span>
          ))}
        </UidLine>
      </span>
      {connection && (
        <span className="flex flex-none flex-col items-end gap-px">
          <span className="text-[11px] text-muted">{t.duration}</span>
          <span className="whitespace-nowrap font-semibold text-base tabular">
            {connection.value}
          </span>
          <span className="text-[11px] text-muted tabular">{connection.since}</span>
        </span>
      )}
    </div>
  )
}

const ICON: Record<StepLook, string> = {
  done: "border-(--ok) bg-(--ok) text-(--on-accent)",
  wait: "border-(--warn) bg-transparent",
  idle: "border-(--field-border) bg-transparent",
  err: "border-danger bg-danger text-(--on-accent)",
}

const DETAIL: Record<StepLook, string> = {
  done: "text-foreground",
  wait: "text-foreground",
  idle: "text-muted",
  err: "text-danger",
}

function StepRow({ step }: { step: Step }) {
  return (
    <li className="flex min-h-[42px] items-center gap-3 border-(--separator) border-t">
      <span
        aria-hidden
        className={cn(
          "flex size-[22px] flex-none items-center justify-center rounded-full border-2 transition-colors duration-200 motion-reduce:transition-none",
          ICON[step.look],
        )}
      >
        {step.look === "done" && <Check className="size-3" strokeWidth={3.5} />}
        {step.look === "wait" && <span className="size-1.5 rounded-full bg-(--warn)" />}
        {step.look === "err" && <X className="size-[11px]" strokeWidth={3.5} />}
      </span>
      <span className="min-w-0 flex-1 font-medium text-[13px]">{step.name}</span>
      <span
        key={step.detail}
        data-rise
        className={cn("text-right text-[12px] tabular", DETAIL[step.look])}
      >
        {step.detail}
      </span>
    </li>
  )
}

/** The changes since the login, a row a second, under when a snapshot was last saved. */
function Changes({ savedAt }: { savedAt: number | null }) {
  const batches = useCaptureStore(s => s.batches)
  const rows = changeRows(batches)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-semibold">{t.changes}</span>
        {savedAt !== null && (
          <span className="text-muted tabular">{t.lastSaved(formatTime(savedAt))}</span>
        )}
      </div>
      <ul className="glass-inset flex flex-col gap-1.5 rounded-[10px] bg-surface-secondary px-3 py-2.5 text-[12px]">
        {rows.length === 0 && <li className="text-muted">{t.noChanges}</li>}
        {rows.slice(0, SHOWN_ROWS).map(row => (
          <li key={row.second} data-rise className="flex items-baseline gap-2.5 tabular">
            <span className="flex-none text-muted">{row.time}</span>
            {/* Keyed by what it says, so a row that gains a change fades it in. */}
            <span key={JSON.stringify(row.lines)} data-rise className="min-w-0">
              <LabeledList items={row.lines} />
            </span>
          </li>
        ))}
        {rows.length > SHOWN_ROWS && (
          <li className="text-muted">{t.moreRows(rows.length - SHOWN_ROWS)}</li>
        )}
      </ul>
    </div>
  )
}

const LABEL: Record<Action, string> = {
  start: t.start,
  stop: t.stop,
  restart: t.restart,
  saveNow: t.saveNow,
  openLog: t.openLog,
}

function act(action: Action) {
  const store = useCaptureStore.getState()
  const run = {
    start: store.start,
    stop: store.stop,
    restart: store.restart,
    saveNow: store.saveNow,
    openLog: store.openLog,
  }[action]
  void run()
}

/** The state's buttons and the link to the settings; a start or stop on its way holds them. */
function Actions({ status }: { status: CaptureStatus }) {
  const busy = useCaptureStore(s => s.busy)
  const { primary, secondary, note } = actionsOf(status)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          isDisabled={busy}
          onPress={() => act(primary)}
          className="h-9 rounded-[9px] px-3.5 font-medium text-[13px]"
        >
          {LABEL[primary]}
        </Button>
        {secondary.map(action => (
          <Button
            key={action}
            variant="secondary"
            isDisabled={busy}
            onPress={() => act(action)}
            className="h-9 rounded-[9px] border border-border bg-transparent px-3.5 font-normal text-[13px] text-foreground"
          >
            {LABEL[action]}
          </Button>
        ))}
        <button
          type="button"
          onClick={() => {
            close()
            navigate("settings")
          }}
          className="ml-auto flex h-9 cursor-pointer items-center gap-1 rounded-[8px] px-1.5 text-(--accent-text) text-[13px] transition-colors hover:bg-default/60 motion-reduce:transition-none"
        >
          {t.settings}
          <ChevronRight aria-hidden className="size-3.5" />
        </button>
      </div>
      {note && <span className="text-[11px] text-muted">{note}</span>}
    </div>
  )
}
