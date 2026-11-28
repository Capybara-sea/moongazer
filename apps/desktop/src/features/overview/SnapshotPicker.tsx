// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ListBox, Select } from "@heroui/react"
import { ChevronDown, History } from "lucide-react"
import { liveUid, timeLabel } from "@/domain/accounts"
import { text } from "@/i18n"
import type { Snapshot } from "@/lib/backend"
import { useAccountStore, useCurrentSnapshot } from "@/stores/accountStore"
import { useCaptureStore } from "@/stores/captureStore"
import { sourceLabel } from "./RecentSnapshots"

/**
 * Which of the account's snapshots the account pages show. Only snapshots
 * whose export is kept have details to show, so only those are listed.
 */
export function SnapshotPicker() {
  const { snapshot, list } = useCurrentSnapshot()
  const kept = list.filter(s => s.hasRaw)
  const live = useCaptureStore(s => liveUid(s.status))
  const label = (s: Snapshot) => timeLabel(s, s === list[0] && s.uid !== null && s.uid === live)
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
          <Select.Value className="flex-none text-[13px] tabular">{label(snapshot)}</Select.Value>
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
              textValue={label(item)}
              className="justify-between gap-4 rounded-[6px] text-[13px]"
            >
              <span className="tabular">{label(item)}</span>
              <span className="text-[12px] text-muted">{sourceLabel(item)}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
