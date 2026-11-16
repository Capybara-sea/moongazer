// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { RotateCw } from "lucide-react"
import { Panel } from "@/components/Panel"
import { Switch } from "@/components/Switch"
import { cn } from "@/lib/cn"
import { type UpdateStatus, useUpdateStore } from "@/stores/updateStore"
import { text } from "@/text/zh"
import { StatusDot, type Tone } from "./StatusDot"

const TONE: Record<UpdateStatus, Tone> = {
  idle: "idle",
  checking: "idle",
  upToDate: "ok",
  available: "warn",
  downloading: "idle",
  ready: "warn",
  restarting: "idle",
  disabled: "idle",
  error: "bad",
}

function percent(downloaded: number, total: number | null) {
  return total ? ` ${Math.min(100, Math.round((downloaded / total) * 100))}%` : ""
}

export function UpdateCard() {
  const status = useUpdateStore(s => s.status)
  const update = useUpdateStore(s => s.update)
  const progress = useUpdateStore(s => s.progress)
  const failed = useUpdateStore(s => s.failed)
  const error = useUpdateStore(s => s.error)
  const autoCheck = useUpdateStore(s => s.autoCheck)
  const version = update?.version ?? ""

  const message = {
    idle: null,
    checking: text.update.checking,
    upToDate: text.update.upToDate,
    available: text.update.available(version),
    downloading:
      text.update.downloading(version) +
      (progress ? percent(progress.downloaded, progress.total) : ""),
    ready: text.update.ready(version),
    restarting: text.update.restarting,
    disabled: text.update.disabled,
    error: `${failed === "download" ? text.update.downloadFailed : text.update.failed}${error ? `: ${error}` : ""}`,
  }[status]

  const busy = status === "checking" || status === "downloading" || status === "restarting"
  const disabled = status === "disabled"

  return (
    <Panel aria-label={text.update.title}>
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold text-[15px]">{text.update.title}</h2>
        <span className="text-[12px] text-muted">{text.update.hint}</span>
      </div>
      {message && <StatusDot tone={TONE[status]}>{message}</StatusDot>}
      {update?.notes && (status === "available" || status === "ready") && (
        <p className="glass-inset whitespace-pre-wrap rounded-[10px] bg-surface-secondary px-3 py-2.5 text-[12px]">
          {update.notes}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          isDisabled={busy || disabled}
          onPress={() => useUpdateStore.getState().check()}
          className="h-9 gap-1.5 rounded-[9px] border border-border bg-transparent px-3.5 font-normal text-[13px] text-foreground"
        >
          <RotateCw
            aria-hidden
            className={cn("m-0 size-[15px]", busy && "animate-spin motion-reduce:animate-none")}
          />
          {text.update.check}
        </Button>
        {(status === "available" || status === "ready") && (
          <Button
            onPress={() => useUpdateStore.getState().install()}
            className="h-9 rounded-[9px] px-3.5 font-medium text-[13px]"
          >
            {status === "ready" ? text.update.restart : text.update.openPage}
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between gap-6 border-(--separator) border-t pt-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-sm">{text.update.autoCheck}</span>
          <span className="text-[12px] text-muted">{text.update.autoCheckHint}</span>
        </div>
        <Switch
          checked={autoCheck}
          label={text.update.autoCheck}
          disabled={disabled}
          onChange={on => useUpdateStore.getState().setAutoCheck(on)}
        />
      </div>
    </Panel>
  )
}
