// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { useEffect, useState } from "react"
import { navigate } from "@/lib/route"
import { anyStored, readStored, writeStored } from "@/lib/storage"
import { useUpdateStore } from "@/stores/updateStore"
import { text } from "@/text/zh"
import { ChangelogSections } from "./ChangelogPage"
import { APP_CHANGELOG, type ChangelogVersion, versionsSince } from "./changelog"
import { SUBPAGES } from "./subpages"

const t = text.changelog
/** The version last run, written once its changes were shown or there were none to show. */
const SEEN_KEY = "moongazer:about:seenVersion"
/** Read before anything of this run is stored: with nothing stored, this is the first run. */
const firstRun = !anyStored()

/** After an update, shows once what changed in each version since the one run before. */
export function WhatsNewDialog() {
  const version = useUpdateStore(s => s.info?.version ?? null)
  const [shown, setShown] = useState<{ version: string; list: ChangelogVersion[] } | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (version === null) return
    const list = versionsSince(APP_CHANGELOG, version, readStored(SEEN_KEY), firstRun)
    if (list.length === 0) {
      writeStored(SEEN_KEY, version)
      return
    }
    setShown({ version, list })
    setOpen(true)
  }, [version])

  const close = () => {
    if (shown) writeStored(SEEN_KEY, shown.version)
    setOpen(false)
  }
  const one = shown?.list.length === 1 ? shown.list[0] : null
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={next => {
        if (!next) close()
      }}
    >
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="max-w-[560px]">
            <AlertDialog.Header>
              <AlertDialog.Icon status="accent" />
              <div className="flex flex-col gap-0.5">
                <AlertDialog.Heading>{shown && t.updated(shown.version)}</AlertDialog.Heading>
                {one && <span className="tabular text-[12px] text-muted">{one.date}</span>}
              </div>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
              {one ? (
                <ChangelogSections sections={one.sections} />
              ) : (
                shown?.list.map(entry => (
                  <div key={entry.version} className="flex flex-col gap-2">
                    <div className="flex items-baseline gap-2 border-(--separator) border-b pb-1">
                      <span className="tabular font-semibold text-sm">{entry.version}</span>
                      <span className="tabular text-[12px] text-muted">{entry.date}</span>
                    </div>
                    <ChangelogSections sections={entry.sections} />
                  </div>
                ))
              )}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="tertiary"
                onPress={() => {
                  close()
                  navigate("about", SUBPAGES.changelog)
                }}
              >
                {t.viewAll}
              </Button>
              <Button variant="primary" onPress={close}>
                {t.done}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
