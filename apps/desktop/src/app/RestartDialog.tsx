// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { useState } from "react"
import { useCaptureStore } from "@/stores/captureStore"
import { type RestartRequest, syncConnected, useRestartStore } from "@/stores/restartStore"
import { text } from "@/text/zh"

/** Asks before a restart, and warns when it would cut auto sync off from the game. */
export function RestartDialog() {
  const pending = useRestartStore(s => s.pending)
  const autoStart = useCaptureStore(s => s.autoStart)
  // The last one stays rendered while the dialog fades out.
  const [shown, setShown] = useState<RestartRequest | null>(pending)
  const [syncing, setSyncing] = useState(false)
  if (pending && pending !== shown) {
    setShown(pending)
    setSyncing(syncConnected())
  }
  const answer = (restart: boolean) => void useRestartStore.getState().answer(restart)
  return (
    <AlertDialog
      isOpen={pending !== null}
      onOpenChange={open => {
        if (!open && useRestartStore.getState().pending) answer(false)
      }}
    >
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status={syncing ? "warning" : "accent"} />
              <AlertDialog.Heading>{shown?.title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-2 text-[13px]">
              {shown?.body.map(line => (
                <p key={line} className="break-all">
                  {line}
                </p>
              ))}
              {syncing && (
                <p className="text-warning">
                  {autoStart ? text.restart.syncAutoStart : text.restart.syncManual}
                </p>
              )}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => answer(false)}>
                {text.restart.cancel}
              </Button>
              <Button variant="primary" onPress={() => answer(true)}>
                {text.restart.now}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
