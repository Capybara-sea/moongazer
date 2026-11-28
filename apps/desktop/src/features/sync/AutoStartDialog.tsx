// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { useCaptureStore } from "@/stores/captureStore"
import { text } from "@/text"

const t = text.sync.askAutoStart

/** After the first start by hand, asks once whether sync should start with the app. */
export function AutoStartDialog() {
  const open = useCaptureStore(s => s.askAutoStart)
  const answer = (on: boolean) => void useCaptureStore.getState().answerAutoStart(on)
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={next => {
        // Esc is a no as well.
        if (!next && useCaptureStore.getState().askAutoStart) answer(false)
      }}
    >
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="accent" />
              <AlertDialog.Heading>{t.title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-2 text-[13px]">
              <p>{t.body}</p>
              <p className="text-muted">{t.later}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => answer(false)}>
                {t.no}
              </Button>
              <Button variant="primary" onPress={() => answer(true)}>
                {t.yes}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
