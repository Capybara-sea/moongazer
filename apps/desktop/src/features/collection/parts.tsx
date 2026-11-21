// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button, Popover } from "@heroui/react"
import type { ReactNode } from "react"
import { Notice } from "@/components/Notice"
import { navigate } from "@/lib/route"
import { useCurrentAccount } from "@/stores/accountStore"
import { useCaptureStore } from "@/stores/captureStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"

/** The collection's parts, by their name in #/collection/<part>. */
export const PARTS = { achievements: "achievements", anecdotes: "anecdotes" } as const

/** "‹ Collection" above a part's title, back to the overview of the collection. */
export function BackLink() {
  return (
    <button
      type="button"
      onClick={() => navigate("collection")}
      className="cursor-pointer self-start text-(--accent-text) text-[13px] hover:underline"
    >
      {text.collection.back}
    </button>
  )
}

/**
 * Why the collection pages have nothing to show, as the other account pages
 * say it: the list failed, there are no snapshots, only a summary is kept or
 * the export failed to read.
 */
export function AccountNotices() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  const capture = useCaptureStore(s => s.capture)
  const { snapshot, entry } = useCurrentAccount()
  return (
    <>
      {loadError && !snapshots && <Notice title={text.overview.loadFailed} detail={loadError} />}
      {snapshots?.length === 0 && (
        <Notice title={text.overview.emptyTitle} detail={text.overview.emptyBody(capture)} />
      )}
      {snapshot && (!snapshot.hasRaw || entry?.status === "summaryOnly") && (
        <Notice title={text.snapshot.summaryOnly} />
      )}
      {entry?.status === "failed" && (
        <Notice title={text.snapshot.loadFailed} detail={entry.message} />
      )}
    </>
  )
}

type InfoProps = {
  /** The trigger's content and its look. */
  trigger: ReactNode
  triggerClassName: string
  /** Read out for the trigger where it shows no text, and the dialog's name. */
  label: string
  children: ReactNode
}

/** A button that opens a short explanation under it. */
export function InfoPopover({ trigger, triggerClassName, label, children }: InfoProps) {
  return (
    <Popover>
      <Button variant="ghost" aria-label={label} className={triggerClassName}>
        {trigger}
      </Button>
      <Popover.Content
        placement="bottom start"
        offset={6}
        className="glass w-[400px] max-w-[calc(100vw-32px)] rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
      >
        <Popover.Dialog
          aria-label={label}
          className="flex flex-col gap-2 p-4 text-[13px] leading-[1.6] outline-none"
        >
          {children}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
