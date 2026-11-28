// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button, Popover } from "@heroui/react"
import { SlidersHorizontal } from "lucide-react"
import { Switch } from "@/components/Switch"
import type { PoolSummary } from "@/domain/wishes"
import { useWishStore } from "@/stores/wishStore"
import { text } from "@/text"

const t = text.wishes

/** Which pools the records show: the ones without records and the novice wish can be hidden. */
export function PoolDisplay({ pools }: { pools: readonly PoolSummary[] }) {
  const open = useWishStore(s => s.displayOpen)
  const hideEmpty = useWishStore(s => s.hideEmpty)
  const hideNovice = useWishStore(s => s.hideNovice)
  const store = useWishStore.getState
  const empty = t.list(pools.filter(pool => pool.total === 0).map(pool => t.pools[pool.key]))
  const options = [
    {
      label: t.display.hideEmpty,
      note: t.display.hideEmptyNote(empty),
      on: hideEmpty,
      set: store().setHideEmpty,
    },
    {
      label: t.display.hideNovice,
      note: t.display.hideNoviceNote,
      on: hideNovice,
      set: store().setHideNovice,
    },
  ]
  return (
    <Popover isOpen={open} onOpenChange={store().setDisplayOpen}>
      <Button isIconOnly variant="secondary" aria-label={t.display.button}>
        <SlidersHorizontal aria-hidden size={16} />
      </Button>
      <Popover.Content
        placement="bottom end"
        offset={6}
        className="glass w-[300px] max-w-[calc(100vw-32px)] rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
      >
        <Popover.Dialog
          aria-label={t.display.title}
          className="flex flex-col gap-0.5 p-2.5 text-[13px] outline-none"
        >
          <span className="px-1.5 pt-0.5 pb-1 text-[11px] text-muted tracking-[0.08em]">
            {t.display.title}
          </span>
          {options.map(option => (
            <div key={option.label} className="flex items-center gap-2.5 rounded-[8px] px-1.5 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{option.label}</span>
                <span className="text-[11px] text-muted">{option.note}</span>
              </span>
              <Switch checked={option.on} label={option.label} onChange={option.set} />
            </div>
          ))}
          <span className="px-1.5 pt-1 pb-0.5 text-[11px] text-muted">{t.display.note}</span>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
