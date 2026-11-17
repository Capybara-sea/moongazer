// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { toast } from "@heroui/react"
import { Download, type LucideIcon, RefreshCw, TriangleAlert } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import { cn } from "@/lib/cn"
import { useMessageStore } from "@/stores/messageStore"
import { useUpdateStore } from "@/stores/updateStore"
import { text } from "@/text/zh"

type Action = { label: string; primary?: boolean; onPress?: () => void }

/** A toast that stays until closed, with its buttons under the text as in the design. */
function notice(
  Icon: LucideIcon,
  tone: "info" | "warn",
  title: string,
  body: ReactNode,
  actions: Action[],
) {
  const id: string = toast(title, {
    indicator: (
      <Icon
        aria-hidden
        className={cn("size-[18px]", tone === "info" ? "text-(--info)" : "text-(--warn)")}
      />
    ),
    description: (
      <>
        {body}
        <span className="mt-2 flex gap-2">
          {actions.map(action => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                toast.close(id)
                action.onPress?.()
              }}
              className={cn(
                "h-7 cursor-pointer rounded-[7px] border px-2.5 text-[12px]",
                action.primary
                  ? "border-accent bg-accent font-semibold text-white"
                  : "border-border bg-transparent font-medium text-foreground",
              )}
            >
              {action.label}
            </button>
          ))}
        </span>
      </>
    ),
    timeout: 0,
  })
}

/**
 * Bottom-right toasts for updates: a download is ready or failed, or a
 * portable build in a read-only folder found a new version. Each shows once
 * per version and event; the About page keeps the same buttons. A ready or
 * found version is also kept in the message center.
 */
export function UpdateToasts() {
  const status = useUpdateStore(s => s.status)
  const version = useUpdateStore(s => s.update?.version)
  const failed = useUpdateStore(s => s.failed)
  const shown = useRef(new Set<string>())

  useEffect(() => {
    if (!version) return
    const key = `${status}:${failed}:${version}`
    if (status === "ready" && !shown.current.has(key)) {
      shown.current.add(key)
      useMessageStore.getState().add({
        id: `update-ready:${version}`,
        kind: "update",
        title: text.update.readyTitle,
        body: text.update.readyToast(version),
        at: Date.now(),
        page: "about",
        action: "restart",
      })
      notice(RefreshCw, "info", text.update.readyTitle, text.update.readyToast(version), [
        {
          label: text.update.restart,
          primary: true,
          onPress: () => useUpdateStore.getState().install(),
        },
        { label: text.update.later },
      ])
    } else if (status === "available" && !shown.current.has(key)) {
      shown.current.add(key)
      useMessageStore.getState().add({
        id: `update-available:${version}`,
        kind: "update",
        title: text.update.available(version),
        body: text.update.portableToast,
        at: Date.now(),
        page: "about",
        action: "download",
      })
      notice(Download, "info", text.update.available(version), text.update.portableToast, [
        {
          label: text.update.openPageShort,
          primary: true,
          onPress: () => useUpdateStore.getState().install(),
        },
        { label: text.update.later },
      ])
    } else if (status === "error" && failed === "download") {
      notice(TriangleAlert, "warn", text.update.downloadFailed, text.update.failedToast, [
        {
          label: text.update.retry,
          primary: true,
          onPress: () => useUpdateStore.getState().download(),
        },
      ])
    }
  }, [status, failed, version])

  return null
}
