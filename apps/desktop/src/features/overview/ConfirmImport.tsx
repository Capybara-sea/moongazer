// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { useState } from "react"
import type { ImportWarning } from "@/lib/backend"
import { type PendingConfirmation, useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"

function describe(warning: ImportWarning) {
  if (warning.kind === "otherAccount") return text.confirm.otherAccount
  return text.confirm.fewer[warning.what](warning.before, warning.after)
}

/** Asks whether to save a file that looks wrong next to the snapshot before it. */
export function ConfirmImport() {
  const pending = useSnapshotStore(s => s.confirmation)
  // The last one stays rendered while the dialog fades out.
  const [shown, setShown] = useState<PendingConfirmation | null>(pending)
  if (pending && pending !== shown) setShown(pending)
  const answer = (save: boolean) => useSnapshotStore.getState().confirm(save)
  return (
    <AlertDialog
      isOpen={pending !== null}
      onOpenChange={open => {
        if (!open && useSnapshotStore.getState().confirmation) answer(false)
      }}
    >
      {/* Esc skips the file: the handler above runs on any dismissal. */}
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>{text.confirm.title}</AlertDialog.Heading>
            </AlertDialog.Header>
            {shown && (
              <AlertDialog.Body className="flex flex-col gap-2 text-[13px]">
                <p className="break-all">{text.confirm.body(shown.file)}</p>
                <ul className="list-disc pl-5">
                  {shown.warnings.map(warning => (
                    <li key={warning.kind === "fewer" ? warning.what : warning.kind}>
                      {describe(warning)}
                    </li>
                  ))}
                </ul>
                <p className="text-muted">{text.confirm.hint}</p>
              </AlertDialog.Body>
            )}
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => answer(false)}>
                {text.confirm.skip}
              </Button>
              <Button variant="danger" onPress={() => answer(true)}>
                {text.confirm.save}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
