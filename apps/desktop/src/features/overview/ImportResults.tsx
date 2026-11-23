// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { CloseButton } from "@heroui/react"
import { Panel } from "@/components/Panel"
import { Tip } from "@/components/Tip"
import { NAME_KINDS } from "@/domain/names"
import type { BackendError } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { formatDateTime } from "@/lib/format"
import { type FileResult, useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"

function failure(error: BackendError) {
  const { errors } = text.importResult
  switch (error.kind) {
    case "invalid":
      return { reason: errors.invalid, detail: error.message }
    case "notGood":
      return { reason: errors.notGood, detail: null }
    case "notLeyline":
      return { reason: errors.notLeyline, detail: errors.notLeylineDetail }
    case "unsupportedVersion":
      return { reason: errors.unsupportedVersion(error.message), detail: null }
    case "storage":
      return { reason: errors.storage, detail: error.message }
    case "read":
      return { reason: errors.read, detail: error.message }
    default:
      return { reason: errors.unknown, detail: error.message }
  }
}

const TONE: Record<FileResult["status"], string> = {
  saved: "text-(--ok)",
  skipped: "text-muted",
  duplicate: "text-muted",
  failed: "text-(--err)",
}

function statusText(result: FileResult) {
  switch (result.status) {
    case "saved":
      return text.importResult.saved
    case "skipped":
      return text.importResult.skipped
    case "duplicate":
      return text.importResult.duplicate(formatDateTime(result.takenAt))
    case "failed":
      return failure(result.error).reason
  }
}

function Row({ result }: { result: FileResult }) {
  const detail = result.status === "failed" ? failure(result.error).detail : null
  return (
    <li data-rise className="flex flex-col gap-0.5 border-(--separator) border-t py-2">
      <div className="flex items-baseline justify-between gap-4 text-[13px]">
        <Tip className="min-w-0 truncate" content={result.file}>
          {result.file}
        </Tip>
        <span className={cn("flex-none", TONE[result.status])}>{statusText(result)}</span>
      </div>
      {detail && <span className="select-text break-all text-[12px] text-muted">{detail}</span>}
    </li>
  )
}

/** The files of the last import, and the keys the bundled names lack. */
export function ImportResults() {
  const results = useSnapshotStore(s => s.results)
  const missing = useSnapshotStore(s => s.unnamed)
  if (!results) return null
  return (
    <Panel aria-label={text.importResult.title} className="gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-[15px]">{text.importResult.title}</h2>
        <CloseButton
          aria-label={text.importResult.close}
          onPress={() => useSnapshotStore.getState().dismissResults()}
        />
      </div>
      <ul className="flex flex-col">
        {results.map(result => (
          <Row key={result.id} result={result} />
        ))}
      </ul>
      {missing && (
        <div className="flex flex-col gap-1.5 border-(--separator) border-t pt-3">
          <span className="font-medium text-sm">{text.importResult.unknownTitle}</span>
          <span className="text-[12px] text-muted">{text.importResult.unknownHint}</span>
          {NAME_KINDS.filter(kind => missing[kind].length > 0).map(kind => (
            <div key={kind} className="flex flex-wrap items-baseline gap-1.5 text-[12px]">
              <span className="text-muted">{text.importResult.kinds[kind]}</span>
              {missing[kind].map(key => (
                <span key={key} className="select-text rounded-[6px] bg-surface-secondary px-1.5">
                  {key}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
