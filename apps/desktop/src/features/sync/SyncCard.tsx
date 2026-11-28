// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronRight } from "lucide-react"
import { StatusDot, type Tone } from "@/components/StatusDot"
import { changeLines, mergeChanges } from "@/domain/changes"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { navigate } from "@/lib/route"
import { useNow } from "@/lib/useNow"
import { useCaptureStore } from "@/stores/captureStore"
import { cardView } from "./states"

const t = text.sync

/** What the side menu's panel says of auto sync, collapsed. */
export type SyncSide = {
  tone: Tone
  label: string
  /** How long it has been connected. */
  duration: string | null
  /** One short line on what the state means. */
  line: string
}

/**
 * Auto sync's state for the side menu's panel, with the panel's clock; null
 * before its state is read. Connected to another account than `shownUid`,
 * the line says whose data it reads.
 */
export function useSyncSide(shownUid: number | null): { side: SyncSide | null; now: number } {
  const status = useCaptureStore(s => s.status)
  const loadError = useCaptureStore(s => s.loadError)
  const batches = useCaptureStore(s => s.batches)
  const now = useNow(15_000)
  if (!status) {
    return {
      side:
        loadError !== null
          ? { tone: "bad", label: t.loadFailed, duration: null, line: t.card.loadFailed[0] }
          : null,
      now,
    }
  }
  const card = cardView(
    status,
    changeLines(mergeChanges(batches)).length,
    batches.at(-1)?.at ?? null,
    now,
  )
  const account = status.account
  const other =
    status.phase === "connected" &&
    account?.uid != null &&
    shownUid !== null &&
    account.uid !== shownUid
  const line = other
    ? t.card.syncingOther(account.nickname ?? String(account.uid))
    : status.phase === "connected"
      ? card.lines[1]
      : card.lines[0]
  return { side: { tone: card.tone, label: card.label, duration: card.duration, line }, now }
}

/** The state with the connection time, and its line: the lower half of the tall panel. */
export function SyncSummary({ side }: { side: SyncSide }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-2 font-semibold">
        <StatusDot tone={side.tone} halo>
          {side.label}
        </StatusDot>
        {side.duration && (
          <span className="ml-auto whitespace-nowrap font-normal text-[11px] text-muted tabular">
            {side.duration}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-[11px] text-muted">{side.line}</span>
    </span>
  )
}

/** In the open panel when the state could not be read at startup: the reason and the settings. */
export function SyncLoadFailed() {
  const loadError = useCaptureStore(s => s.loadError)
  return (
    <div className="flex flex-col gap-2 p-[18px] text-[13px]">
      <StatusDot tone="bad" className="font-semibold">
        {t.loadFailed}
      </StatusDot>
      <p className="select-text text-muted">{loadError}</p>
      <button
        type="button"
        onClick={() => {
          useCaptureStore.getState().setPanelOpen(false)
          navigate("settings")
        }}
        className="flex h-9 cursor-pointer items-center gap-1 self-start rounded-[8px] px-1.5 text-(--accent-text) transition-colors hover:bg-default/60 motion-reduce:transition-none"
      >
        {t.card.loadFailed[1]}
        <ChevronRight aria-hidden className="size-3.5" />
      </button>
    </div>
  )
}

/**
 * Dims the page while the panel is open, as the design does. A layer over
 * the page rather than a lower opacity on it, which would turn its glass
 * cards grey.
 */
export function SyncShade() {
  const open = useCaptureStore(s => s.panelOpen)
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-3 bg-(--background) transition-opacity duration-200 ease-out motion-reduce:transition-none",
        open ? "opacity-65" : "opacity-0",
      )}
    />
  )
}
