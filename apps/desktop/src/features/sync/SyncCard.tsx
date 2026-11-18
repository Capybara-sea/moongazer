// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button, Popover } from "@heroui/react"
import { StatusDot } from "@/components/StatusDot"
import { changeLines, mergeChanges } from "@/domain/changes"
import { cn } from "@/lib/cn"
import { navigate } from "@/lib/route"
import { useNow } from "@/lib/useNow"
import { useCaptureStore } from "@/stores/captureStore"
import { text } from "@/text/zh"
import { SyncPanel } from "./SyncPanel"
import { cardView } from "./states"

const t = text.sync

const CARD =
  "mb-2 flex h-auto w-full min-w-0 flex-col items-stretch justify-start gap-0.5 whitespace-normal rounded-[10px] border px-3 py-2.5 text-left font-normal text-foreground transition-colors duration-200 motion-reduce:transition-none"
const CARD_CLOSED = "glass-inset border-border bg-surface-secondary hover:bg-default/60"

/**
 * The side menu's auto sync card: the state, with the connection time while
 * connected. It opens the connection panel beside the side menu, its bottom
 * 12 px above the window's as in the design. Builds without auto sync show
 * nothing.
 */
export function SyncCard() {
  const capture = useCaptureStore(s => s.capture)
  const status = useCaptureStore(s => s.status)
  const loadError = useCaptureStore(s => s.loadError)
  const batches = useCaptureStore(s => s.batches)
  const open = useCaptureStore(s => s.panelOpen)
  const now = useNow(15_000)
  if (!status) return capture && loadError ? <FailedCard /> : null
  const lines = changeLines(mergeChanges(batches)).length
  const card = cardView(status, lines, batches.at(-1)?.at ?? null, now)
  return (
    <Popover isOpen={open} onOpenChange={next => useCaptureStore.getState().setPanelOpen(next)}>
      <Button
        variant="ghost"
        aria-label={t.cardLabel(card.label, card.lines)}
        className={cn(
          CARD,
          open ? "border-accent bg-(--accent-soft) shadow-[0_0_0_1px_var(--accent)]" : CARD_CLOSED,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <StatusDot tone={card.tone} halo>
            {card.label}
          </StatusDot>
          {card.duration && (
            <span className="ml-auto whitespace-nowrap font-normal text-[11px] text-muted tabular">
              {card.duration}
            </span>
          )}
        </span>
        <CardLines lines={card.lines} />
      </Button>
      <Popover.Content
        placement="end bottom"
        // 8 px past the side menu; pushed down until it meets the window's padding.
        offset={16}
        crossOffset={80}
        className="glass w-[460px] max-w-[calc(100vw-200px)] overflow-hidden rounded-[18px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
      >
        <Popover.Dialog
          aria-label={t.panel}
          className="max-h-[calc(100vh-56px)] overflow-y-auto p-0 outline-none"
        >
          <SyncPanel now={now} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}

function CardLines({ lines }: { lines: readonly [string, string] }) {
  return (
    <>
      <span className="truncate text-[11px] text-muted">{lines[0]}</span>
      <span className="truncate text-[11px] text-muted">{lines[1]}</span>
    </>
  )
}

/** The status could not be read at startup: the card says so and leads to the settings. */
function FailedCard() {
  return (
    <Button
      variant="ghost"
      aria-label={t.cardLabel(t.loadFailed, t.card.loadFailed)}
      onPress={() => navigate("settings")}
      className={cn(CARD, CARD_CLOSED)}
    >
      <span className="flex min-w-0 items-center gap-2 font-semibold">
        <StatusDot tone="bad" halo>
          {t.loadFailed}
        </StatusDot>
      </span>
      <CardLines lines={t.card.loadFailed} />
    </Button>
  )
}

/**
 * Dims the page while the panel is open, as the design does. A layer over
 * the page rather than a lower opacity on it, which would turn its glass
 * cards grey. The panel opens only once the card shows (see setPanelOpen).
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
