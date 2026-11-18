// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect } from "react"
import type { Snapshot } from "@/lib/backend"
import {
  onCaptureChange,
  onCaptureChangesCleared,
  onCaptureStatus,
  onSnapshotHead,
  onSnapshotsChanged,
} from "@/lib/backend/sync"
import { useAccountStore } from "@/stores/accountStore"
import { useCaptureStore } from "@/stores/captureStore"
import { useMessageStore } from "@/stores/messageStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { reviewMessage, statusMessages } from "./messages"
import { loginSettled } from "./states"

/** Asks about each snapshot marked for review; the message's id keeps it to once. */
function announceReviews(snapshots: Snapshot[] | null) {
  for (const snapshot of snapshots ?? []) {
    if (snapshot.review) useMessageStore.getState().add(reviewMessage(snapshot))
  }
}

/** A head row that came while the window was hidden was not read; it is once the window shows. */
function readWhenShown() {
  if (!document.hidden) useAccountStore.getState().loadSkipped()
}

/**
 * Takes auto sync's events: the status and the changes for the panel, a
 * message when something goes wrong, the history read again after a save,
 * each batch's head row put in and the pages on the account of each login.
 * A snapshot marked for review is announced whenever the history is read, so
 * one saved while the app was closed is announced at the next start. Renders
 * nothing.
 */
export function SyncEvents() {
  useEffect(() => {
    const listening = [
      onCaptureStatus(status => {
        const { status: before, version } = useCaptureStore.getState()
        useCaptureStore.getState().setStatus(status)
        for (const message of statusMessages(before, status, Date.now(), version)) {
          useMessageStore.getState().add(message)
        }
        // The pages go to the account that logged in, even after another was chosen.
        if (loginSettled(before, status)) {
          useAccountStore.getState().selectLogin(status.account?.uid ?? null)
        }
      }),
      onCaptureChange(batch => useCaptureStore.getState().addBatch(batch)),
      onCaptureChangesCleared(() => useCaptureStore.getState().clearBatches()),
      onSnapshotsChanged(() => {
        void useSnapshotStore.getState().load()
      }),
      onSnapshotHead(head => useSnapshotStore.getState().setHead(head)),
    ]
    document.addEventListener("visibilitychange", readWhenShown)
    // The history may have been read before this subscribed.
    announceReviews(useSnapshotStore.getState().snapshots)
    const unsubscribe = useSnapshotStore.subscribe((state, previous) => {
      if (state.snapshots !== previous.snapshots) announceReviews(state.snapshots)
    })
    return () => {
      unsubscribe()
      document.removeEventListener("visibilitychange", readWhenShown)
      for (const unlisten of listening) void unlisten.then(stop => stop())
    }
  }, [])
  return null
}
