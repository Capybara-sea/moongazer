// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import qrCode from "@community/qq-group.svg"
import { AlertDialog, Button } from "@heroui/react"
import { Check, Copy, QrCode } from "lucide-react"
import { useEffect, useState } from "react"
import { useTip } from "@/components/Tip"
import { text } from "@/text/zh"

const t = text.about
const COPIED_MS = 1500

/** The group's line under its title, with a button that copies the number. */
export function GroupChatHint() {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])
  const Icon = copied ? Check : Copy
  const label = copied ? t.groupNumberCopied : t.copyGroupNumber
  const tip = useTip<HTMLButtonElement>(label)
  return (
    <>
      {t.groupChatJoin} <span className="select-text text-foreground">{t.groupNumber}</span>
      <button
        {...tip.props}
        type="button"
        aria-label={label}
        onClick={() => {
          navigator.clipboard.writeText(t.groupNumber).then(
            () => setCopied(true),
            () => {
              // The number stays selectable, to copy by hand.
            },
          )
        }}
        className="mx-0.5 inline-flex size-5 cursor-pointer items-center justify-center rounded-[5px] align-[-5px] text-muted transition-colors duration-150 hover:bg-default/60 hover:text-foreground motion-reduce:transition-none"
      >
        <Icon aria-hidden className={copied ? "size-3.5 text-(--ok)" : "size-3.5"} />
        {tip.bubble}
      </button>
      {t.groupChatRest}
    </>
  )
}

/**
 * Shows the QQ group's QR code, to scan with a phone. Dark on white in both
 * themes (the svg has its own white ground): not every scanner reads a light
 * code on a dark ground.
 */
export function GroupQrButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="secondary"
        isIconOnly
        aria-label={t.showGroupQr}
        onPress={() => setOpen(true)}
        className="size-9 flex-none rounded-[9px] border border-border bg-transparent text-foreground"
      >
        <QrCode aria-hidden className="m-0 size-[15px]" />
      </Button>
      <AlertDialog isOpen={open} onOpenChange={setOpen}>
        <AlertDialog.Backdrop isDismissable isKeyboardDismissDisabled={false}>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="max-w-[320px]">
              <AlertDialog.Header>
                <AlertDialog.Heading>{t.groupChat}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="flex flex-col items-center gap-3 text-[13px]">
                <img
                  src={qrCode}
                  alt={t.groupQrAlt}
                  width={208}
                  height={208}
                  draggable={false}
                  className="size-52 rounded-[12px]"
                />
                <p className="text-center text-muted">{t.groupQrHint}</p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" onPress={() => setOpen(false)}>
                  {t.closeGroupQr}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  )
}
