// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { useState } from "react"
import { text } from "@/i18n"
import { type PendingConfirmation, useSnapshotStore } from "@/stores/snapshotStore"

/**
 * Asks whether to save a file that looks wrong next to its account's snapshot
 * before it, or that is of an account not saved yet while others are.
 */
export function ConfirmImport() {
  const pending = useSnapshotStore(s => s.confirmation)
  // The last one stays rendered while the dialog fades out.
  const [shown, setShown] = useState<PendingConfirmation | null>(pending)
  if (pending && pending !== shown) setShown(pending)
  const answer = (save: boolean) => useSnapshotStore.getState().confirm(save)
  // A new account has no snapshot before it, so nothing else is said with it.
  const isNew = shown?.warnings.some(w => w.kind === "newAccount") ?? false
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
              <AlertDialog.Icon status={isNew ? "accent" : "warning"} />
              <AlertDialog.Heading>
                {isNew ? text.confirm.newTitle : text.confirm.title}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            {shown && (
              <AlertDialog.Body className="flex flex-col gap-2 text-[13px]">
                {isNew ? (
                  <p className="wrap-anywhere">{text.confirm.newBody(shown.file)}</p>
                ) : (
                  <>
                    <p className="wrap-anywhere">{text.confirm.body(shown.file)}</p>
                    <ul className="list-disc pl-5">
                      {shown.warnings.map(warning =>
                        warning.kind === "fewer" ? (
                          <li key={warning.what}>
                            {text.confirm.fewer[warning.what](warning.before, warning.after)}
                          </li>
                        ) : null,
                      )}
                    </ul>
                    <p className="text-muted">{text.confirm.hint}</p>
                  </>
                )}
              </AlertDialog.Body>
            )}
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => answer(false)}>
                {text.confirm.skip}
              </Button>
              <Button variant={isNew ? "primary" : "danger"} onPress={() => answer(true)}>
                {isNew ? text.confirm.newSave : text.confirm.save}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
