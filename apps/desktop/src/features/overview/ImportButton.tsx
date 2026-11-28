// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { Upload } from "lucide-react"
import { useRef } from "react"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { navigate } from "@/lib/route"
import { useSnapshotStore } from "@/stores/snapshotStore"

/**
 * Imports the chosen Leyline files on the overview, where their results and
 * confirmations show.
 */
export function ImportButton({
  label = text.overview.importFile,
  quiet = false,
}: {
  label?: string
  /** Second to another action: no fill, muted text. */
  quiet?: boolean
}) {
  const progress = useSnapshotStore(s => s.progress)
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
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
          navigate("overview")
          void useSnapshotStore.getState().importFiles(files)
        }}
      />
      <Button
        variant={quiet ? "ghost" : "primary"}
        isDisabled={progress !== null}
        onPress={() => input.current?.click()}
        className={cn(
          "h-[38px] gap-2 rounded-[9px] px-3.5 font-medium text-[13px]",
          quiet && "font-normal text-muted hover:text-foreground",
        )}
      >
        <Upload aria-hidden className="m-0 size-4" />
        {progress ? text.overview.importing(progress.done, progress.total) : label}
      </Button>
    </>
  )
}
