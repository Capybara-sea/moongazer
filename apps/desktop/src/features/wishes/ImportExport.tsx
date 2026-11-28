// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button, Popover } from "@heroui/react"
import { ChevronDown, ExternalLink, Upload } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { CheckboxField } from "@/components/CheckboxField"
import { itemOf, type WishRecord } from "@/domain/wishes"
import { toBackendError } from "@/lib/backend"
import {
  exportWishFile,
  type FileAccount,
  importWishFile,
  openUigf,
  readWishFile,
} from "@/lib/backend/wishes"
import { cn } from "@/lib/cn"
import { formatDate, maskUid } from "@/lib/format"
import { useAccountStore } from "@/stores/accountStore"
import { useWishStore } from "@/stores/wishStore"
import { text } from "@/text"
import { itemView } from "./items"

const t = text.wishes

type Asking = { text: string; accounts: FileAccount[] }

/**
 * Imports a UIGF file into the shown account. A file of just this account is
 * imported at once; otherwise the user picks which of its accounts, among the
 * ones Moongazer knows, to import (no account is made for a UID it does not).
 */
export function ImportButton({ uid, primary = false }: { uid: number; primary?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const accounts = useAccountStore(s => s.accounts)
  const known = useMemo(
    () => new Set(accounts.flatMap(g => (g.uid === null ? [] : [g.uid]))),
    [accounts],
  )
  const [asking, setAsking] = useState<Asking | null>(null)
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const store = useWishStore.getState

  const finish = async (fileText: string, uids: number[]) => {
    setBusy(true)
    try {
      const results = await importWishFile(fileText, uids)
      store().setNotice({ kind: "import", results, uid })
      void store().load(uid, true)
    } catch (error) {
      store().setNotice({
        kind: "error",
        message: `${t.notice.importFailed}: ${toBackendError(error).message}`,
      })
    } finally {
      setBusy(false)
    }
  }

  const read = async (file: File) => {
    const fileText = await file.text()
    let inFile: FileAccount[]
    try {
      inFile = await readWishFile(fileText)
    } catch (error) {
      const failure = toBackendError(error)
      const message =
        failure.kind === "oldVersion"
          ? t.notice.oldVersion(failure.message)
          : failure.kind === "notJson" || failure.kind === "notUigf"
            ? t.notice.notUigf
            : `${t.notice.importFailed}: ${failure.message}`
      store().setNotice({ kind: "error", message })
      return
    }
    if (inFile.length === 0) {
      store().setNotice({ kind: "error", message: t.notice.noGenshin })
    } else if (inFile.length === 1 && inFile[0]?.uid === uid) {
      await finish(fileText, [uid])
    } else if (!inFile.some(account => known.has(account.uid))) {
      store().setNotice({ kind: "error", message: t.notice.noMatch })
    } else {
      setPicked(new Set(inFile.flatMap(a => (known.has(a.uid) ? [a.uid] : []))))
      setAsking({ text: fileText, accounts: inFile })
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={e => {
          const file = e.currentTarget.files?.[0]
          // Cleared, so choosing the same file again fires another change.
          e.currentTarget.value = ""
          if (file) void read(file)
        }}
      />
      <Button
        variant={primary ? "primary" : "secondary"}
        isDisabled={busy}
        onPress={() => input.current?.click()}
        className="gap-2"
      >
        <Upload aria-hidden className="size-4" />
        {primary ? t.importFile : t.importButton}
      </Button>
      <AlertDialog
        isOpen={asking !== null}
        onOpenChange={open => {
          if (!open) setAsking(null)
        }}
      >
        <AlertDialog.Backdrop isDismissable isKeyboardDismissDisabled={false}>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="w-[420px] max-w-full">
              <AlertDialog.Header>
                <AlertDialog.Heading>{t.importDialog.title}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="flex flex-col gap-2 text-[13px]">
                {asking?.accounts.map(account => {
                  const line = t.importDialog.line(maskUid(account.uid), account.records)
                  return known.has(account.uid) ? (
                    <CheckboxField
                      key={account.uid}
                      checked={picked.has(account.uid)}
                      label={line}
                      onChange={on => {
                        const next = new Set(picked)
                        if (on) next.add(account.uid)
                        else next.delete(account.uid)
                        setPicked(next)
                      }}
                    />
                  ) : (
                    <span key={account.uid} className="flex flex-col py-1 text-muted">
                      <span className="tabular">{line}</span>
                      <span className="text-[12px]">{t.importDialog.unknown}</span>
                    </span>
                  )
                })}
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  {t.importDialog.cancel}
                </Button>
                <Button
                  isDisabled={picked.size === 0 || busy}
                  onPress={() => {
                    if (!asking) return
                    setAsking(null)
                    void finish(asking.text, [...picked])
                  }}
                >
                  {t.importDialog.confirm}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  )
}

type ExportProps = { uid: number; name: string; records: readonly WishRecord[] }

/** Exports the account's every record as a UIGF v4 file, its items named in the UI's language. */
export function ExportMenu({ uid, name, records }: ExportProps) {
  const [open, setOpen] = useState(false)
  const store = useWishStore.getState
  const run = async () => {
    setOpen(false)
    const items: Record<number, [string, string]> = {}
    for (const record of records) {
      const item = itemOf(record.itemId)
      if (!item || record.itemId in items) continue
      items[record.itemId] = [itemView(record.itemId).name, t.itemTypes[item.kind]]
    }
    try {
      const path = await exportWishFile(
        uid,
        items,
        t.uigfLang,
        t.exportName(name, formatDate(Date.now()).replaceAll("-", "")),
      )
      if (path !== null) store().setNotice({ kind: "export", count: records.length, path })
    } catch (error) {
      store().setNotice({
        kind: "error",
        message: `${t.notice.exportFailed}: ${toBackendError(error).message}`,
      })
    }
  }
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button variant="primary" className="gap-1.5" aria-haspopup="menu">
        {t.exportButton}
        <ChevronDown aria-hidden className="size-3.5" />
      </Button>
      <Popover.Content
        placement="bottom end"
        offset={6}
        className="glass w-[260px] rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
      >
        <Popover.Dialog
          aria-label={t.exportButton}
          className="flex flex-col p-1.5 text-[13px] outline-none"
        >
          <button
            type="button"
            onClick={() => void run()}
            className="flex cursor-pointer flex-col items-start rounded-[8px] px-2.5 py-2 text-left hover:bg-default/60"
          >
            <span>{t.exportFile}</span>
            <span className="text-[11px] text-muted tabular">
              {t.exportLine(name, records.length)}
            </span>
          </button>
          <span aria-hidden className="mx-1.5 my-1 h-px bg-(--separator)" />
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void openUigf().catch(() => {})
            }}
            className={cn(
              "flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[8px] px-2.5 text-(--accent-text) text-[12px] hover:bg-default/60",
            )}
          >
            {t.aboutUigf}
            <ExternalLink aria-hidden className="size-3" />
          </button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
