// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { Upload } from "lucide-react"
import { useRef } from "react"
import { Panel } from "@/components/Panel"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"
import { ConfirmImport } from "./ConfirmImport"
import { ImportResults } from "./ImportResults"
import { RecentSnapshots, sourceLabel } from "./RecentSnapshots"

/**
 * The account overview. For now: importing files and the snapshot history;
 * the account cards follow the design in later milestones.
 */
export function OverviewPage() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4.5 p-6">
      <Header />
      <ImportResults />
      {loadError && !snapshots && (
        <Panel aria-label={text.overview.loadFailed} className="gap-0.5">
          <h2 className="font-semibold text-[15px]">{text.overview.loadFailed}</h2>
          <p className="select-text text-[12px] text-muted">{loadError}</p>
        </Panel>
      )}
      {snapshots?.length === 0 && (
        <Panel aria-label={text.overview.emptyTitle} className="gap-0.5">
          <h2 className="font-semibold text-[15px]">{text.overview.emptyTitle}</h2>
          <p className="text-[13px] text-muted">{text.overview.emptyBody}</p>
        </Panel>
      )}
      {snapshots && snapshots.length > 0 && <RecentSnapshots snapshots={snapshots} />}
      <ConfirmImport />
    </div>
  )
}

function Header() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const progress = useSnapshotStore(s => s.progress)
  const input = useRef<HTMLInputElement>(null)
  const latest = snapshots?.[0]
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col">
        <h1 className="font-semibold text-[20px] leading-[1.3]">{text.overview.title}</h1>
        {latest && (
          <span className="text-[12px] text-muted">
            {text.overview.source(sourceLabel(latest, true), snapshots.length)}
          </span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        onChange={e => {
          const files = [...(e.currentTarget.files ?? [])]
          // Cleared, so choosing the same file again fires another change.
          e.currentTarget.value = ""
          void useSnapshotStore.getState().importFiles(files)
        }}
      />
      <Button
        isDisabled={progress !== null}
        onPress={() => input.current?.click()}
        className="h-[38px] gap-2 rounded-[9px] px-3.5 font-medium text-[13px]"
      >
        <Upload aria-hidden className="m-0 size-4" />
        {progress
          ? text.overview.importing(progress.done, progress.total)
          : text.overview.importFile}
      </Button>
    </div>
  )
}
