// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button, Popover } from "@heroui/react"
import { ChevronRight } from "lucide-react"
import { useState } from "react"
import type { AccountGroup } from "@/domain/accounts"
import {
  AccountFace,
  AccountList,
  DeleteAccountDialog,
  useShownAccount,
} from "@/features/accounts/AccountSwitcher"
import { SyncLoadFailed, SyncSummary, useSyncSide } from "@/features/sync/SyncCard"
import { SyncPanel } from "@/features/sync/SyncPanel"
import { cn } from "@/lib/cn"
import { useAccountStore } from "@/stores/accountStore"
import { useCaptureStore } from "@/stores/captureStore"
import { text } from "@/text"

const BLOCK =
  "glass-inset flex h-auto w-full min-w-0 flex-col items-stretch justify-start gap-1.5 whitespace-normal rounded-[10px] border px-3 py-2.5 text-left font-normal text-foreground shadow-none transition-colors duration-200 motion-reduce:transition-none"
const CLOSED = "border-border bg-surface-secondary"
const ARROW = <ChevronRight aria-hidden className="size-3.5 flex-none self-start text-muted" />

/**
 * The side menu's bottom: the account the pages show and auto sync's state
 * in one block. In a tall window each has its own lines; in a short one they
 * share two. It opens a panel beside the side menu with every account and the
 * auto sync panel. Without auto sync and with one account it does not open.
 * Deleting an account asks outside the panel, which closes on the click.
 */
export function SidePanel() {
  const capture = useCaptureStore(s => s.capture)
  const status = useCaptureStore(s => s.status)
  const open = useCaptureStore(s => s.panelOpen)
  const accounts = useAccountStore(s => s.accounts)
  const shown = useShownAccount()
  const { side, now } = useSyncSide(shown?.group.uid ?? null)
  const [deleting, setDeleting] = useState<AccountGroup | null>(null)
  const dialog = <DeleteAccountDialog account={deleting} onClose={() => setDeleting(null)} />
  // Nothing to show yet while auto sync's state is read, with one account.
  const opens = accounts.length > 1 || (capture && (status !== null || side !== null))
  const shortLine = side
    ? [side.label, side.duration].filter(Boolean).join(" · ")
    : (shown?.uid ?? undefined)
  const body = (
    <>
      {/* A window 700 px tall or more has room for two lines each. The sync half has its own
          dot there, so the picture has none. */}
      <span className="hidden min-w-0 flex-col gap-1.5 [@media(min-height:700px)]:flex">
        <AccountFace tone={null} trailing={opens && ARROW} />
        {side && (
          <>
            <span aria-hidden className="h-px bg-(--separator)" />
            <SyncSummary side={side} />
          </>
        )}
      </span>
      <span className="flex min-w-0 flex-col [@media(min-height:700px)]:hidden">
        <AccountFace
          tone={side?.tone ?? null}
          line={shown || side ? shortLine : undefined}
          trailing={opens && ARROW}
        />
      </span>
    </>
  )
  if (!opens) {
    return (
      <>
        <div className={cn(BLOCK, CLOSED)}>{body}</div>
        {dialog}
      </>
    )
  }
  return (
    <>
      <Popover isOpen={open} onOpenChange={next => useCaptureStore.getState().setPanelOpen(next)}>
        <Button
          variant="ghost"
          aria-label={text.sync.panelLabel(shown?.name ?? text.accounts.none, side?.label)}
          className={cn(
            BLOCK,
            open
              ? "border-accent bg-(--accent-soft) shadow-[0_0_0_1px_var(--accent)]"
              : cn(CLOSED, "hover:bg-default/60"),
          )}
        >
          {body}
        </Button>
        {/* Beside the side menu, level with its bottom. */}
        <Popover.Content
          placement="end bottom"
          offset={16}
          className="glass w-[460px] max-w-[calc(100vw-200px)] overflow-hidden rounded-[18px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
        >
          <Popover.Dialog
            aria-label={text.accounts.panel}
            className="max-h-[calc(100vh-56px)] overflow-y-auto p-0 outline-none"
          >
            {accounts.length > 1 && <AccountList onDelete={setDeleting} />}
            {accounts.length > 1 && capture && (
              <span aria-hidden className="mx-5 block h-px bg-(--separator)" />
            )}
            {status ? <SyncPanel now={now} /> : side && <SyncLoadFailed />}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      {dialog}
    </>
  )
}
