// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { type ReactNode, useEffect, useState } from "react"
import { text } from "@/text/zh"

/** How long the delete button stays disabled, against a hasty click. */
const DELETE_DELAY_S = 3

type Props = {
  open: boolean
  title: string
  children: ReactNode
  /** Called with true for the delete button, false for cancel, Esc or a click outside. */
  onAnswer: (remove: boolean) => void
}

/** Asks before a delete, which cannot be undone; its delete button counts down first. */
export function ConfirmDelete({ open, title, children, onAnswer }: Props) {
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
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="text-[13px]">{children}</AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => onAnswer(false)}>
                {text.confirmDelete.cancel}
              </Button>
              <Button
                variant="danger"
                isDisabled={left > 0}
                onPress={() => onAnswer(true)}
                className="tabular"
              >
                {left > 0 ? text.confirmDelete.deleteIn(left) : text.confirmDelete.delete}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
