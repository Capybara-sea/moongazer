// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { TriangleAlert } from "lucide-react"
import { useEffect, useState } from "react"
import { Panel } from "@/components/Panel"
import { type Snapshot, toBackendError } from "@/lib/backend"
import { formatDateTime } from "@/lib/format"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"
import { checkedAgainst, deleteTakes, reviewReasons } from "./review"

/** How long the delete button in the confirmation stays disabled, against a hasty click. */
const DELETE_DELAY_S = 3

/**
 * A notice for each snapshot auto sync saved although it looked wrong, to keep
 * or delete, of every account: messages send the user here for any of them.
 */
export function ReviewNotices({ snapshots }: { snapshots: Snapshot[] }) {
  return snapshots.map((snapshot, i) =>
    snapshot.review ? (
      <ReviewNotice
        key={snapshot.id}
        snapshot={snapshot}
        previous={checkedAgainst(snapshot, snapshots.slice(i + 1))}
        takes={deleteTakes(snapshot, snapshots)}
      />
    ) : null,
  )
}

type NoticeProps = { snapshot: Snapshot; previous?: Snapshot; takes: string | null }

function ReviewNotice({ snapshot, previous, takes }: NoticeProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const when = formatDateTime(snapshot.takenAt)
  const answer = async (keep: boolean) => {
    const store = useSnapshotStore.getState()
    setBusy(true)
    setError(null)
    try {
      await (keep ? store.keep(snapshot.id) : store.remove(snapshot.id))
      // The answer went through, but the history may not have been read again.
      const loadError = useSnapshotStore.getState().loadError
      if (loadError) setError(`${text.overview.loadFailed}: ${loadError}`)
    } catch (e) {
      setError(`${text.review.failed}: ${toBackendError(e).message}`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel aria-label={text.messages.syncReview} className="flex-row gap-3">
      <TriangleAlert aria-hidden className="mt-0.5 size-[18px] flex-none text-(--warn)" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px]">
        <h2 className="font-semibold text-[15px]">{text.messages.syncReview}</h2>
        <p>{text.review.body(when)}</p>
        <ul className="list-disc pl-5">
          {reviewReasons(snapshot, previous).map(reason => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="text-[12px] text-muted">{text.review.hint}</p>
        {error && <p className="select-text text-[12px] text-danger">{error}</p>}
        <div className="mt-1 flex gap-2">
          <Button
            isDisabled={busy}
            onPress={() => void answer(true)}
            className="h-[34px] rounded-[9px] px-3.5 font-medium text-[13px]"
          >
            {text.review.keep}
          </Button>
          <Button
            variant="danger"
            isDisabled={busy}
            onPress={() => setConfirming(true)}
            className="h-[34px] rounded-[9px] px-3.5 font-medium text-[13px]"
          >
            {text.review.delete}
          </Button>
        </div>
      </div>
      <ConfirmDelete
        open={confirming}
        when={when}
        takes={takes}
        onAnswer={remove => {
          setConfirming(false)
          if (remove) void answer(false)
        }}
      />
    </Panel>
  )
}

type ConfirmProps = {
  open: boolean
  when: string
  takes: string | null
  onAnswer: (remove: boolean) => void
}

/** Asks before a delete, which cannot be undone; its delete button counts down first. */
function ConfirmDelete({ open, when, takes, onAnswer }: ConfirmProps) {
  const [left, setLeft] = useState(DELETE_DELAY_S)
  // Set back during render, so a dialog opened again never shows the button enabled.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setLeft(DELETE_DELAY_S)
  }
  useEffect(() => {
    if (!open || left === 0) return
    const timer = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(timer)
  }, [open, left])
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={next => {
        if (!next) onAnswer(false)
      }}
    >
      {/* Esc cancels: the handler above runs on any dismissal. */}
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{text.review.confirmTitle}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="text-[13px]">
              <p>
                {text.review.confirmBody(when)}
                {takes}
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => onAnswer(false)}>
                {text.review.cancel}
              </Button>
              <Button
                variant="danger"
                isDisabled={left > 0}
                onPress={() => onAnswer(true)}
                className="tabular"
              >
                {left > 0 ? text.review.deleteIn(left) : text.review.delete}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
