// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ListBox, Select } from "@heroui/react"
import { ChevronDown, History } from "lucide-react"
import { formatDateTime } from "@/lib/format"
import { useAccountStore, useCurrentSnapshot } from "@/stores/accountStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"
import { sourceLabel } from "./RecentSnapshots"

/**
 * Which snapshot the account pages show. Only snapshots whose export is kept
 * have details to show, so only those are listed.
 */
export function SnapshotPicker() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const { snapshot } = useCurrentSnapshot()
  const kept = snapshots?.filter(s => s.hasRaw) ?? []
  return (
    <Select
      aria-label={text.snapshot.pick}
      isDisabled={kept.length === 0}
      value={snapshot?.id ?? null}
      onChange={key => {
        if (key === null) return
        // The newest is chosen as "none", so the pages keep following new imports.
        useAccountStore.getState().select(key === kept[0]?.id ? null : Number(key))
      }}
      className="group"
    >
      <Select.Trigger className="h-[38px] items-center gap-2 rounded-[9px] px-3 py-0 text-[13px] text-foreground shadow-none">
        <History aria-hidden className="size-4 flex-none" />
        <span className="text-muted">{text.snapshot.label}</span>
        {snapshot && (
          <Select.Value className="flex-none text-[13px] tabular">
            {formatDateTime(snapshot.takenAt)}
          </Select.Value>
        )}
        <ChevronDown
          aria-hidden
          className="size-3.5 flex-none transition-transform duration-150 ease-out group-data-open:rotate-180 motion-reduce:transition-none"
        />
      </Select.Trigger>
      <Select.Popover
        placement="bottom end"
        maxHeight={360}
        className="rounded-[12px] border border-border shadow-(--pop-shadow) motion-reduce:animate-none"
      >
        <ListBox>
          {kept.map(item => (
            <ListBox.Item
              key={item.id}
              id={item.id}
              textValue={formatDateTime(item.takenAt)}
              className="justify-between gap-4 rounded-[6px] text-[13px]"
            >
              <span className="tabular">{formatDateTime(item.takenAt)}</span>
              <span className="text-[12px] text-muted">{sourceLabel(item, false)}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
