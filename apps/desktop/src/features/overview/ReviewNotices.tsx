// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { TriangleAlert } from "lucide-react"
import { useState } from "react"
import { ConfirmDelete } from "@/components/ConfirmDelete"
import { Panel } from "@/components/Panel"
import { type Snapshot, toBackendError } from "@/lib/backend"
import { formatDateTime } from "@/lib/format"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"
import { checkedAgainst, deleteTakes, reviewReasons } from "./review"

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
        {error && <p className="select-text text-[12px] text-(--err)">{error}</p>}
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
        title={text.review.confirmTitle}
        onAnswer={remove => {
          setConfirming(false)
          if (remove) void answer(false)
        }}
      >
        <p>
          {text.review.confirmBody(when)}
          {takes}
        </p>
      </ConfirmDelete>
    </Panel>
  )
}
