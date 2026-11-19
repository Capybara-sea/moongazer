// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ListBox, Select } from "@heroui/react"
import { ChevronDown, UserRound } from "lucide-react"
import { useId } from "react"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { type AccountGroup, liveUid, timeLabel } from "@/domain/accounts"
import { cn } from "@/lib/cn"
import { maskUid } from "@/lib/format"
import { accountName, useAccountStore } from "@/stores/accountStore"
import { useAppearanceStore } from "@/stores/appearanceStore"
import { useCaptureStore } from "@/stores/captureStore"
import { text } from "@/text/zh"

const t = text.accounts
const BLOCK =
  "glass-inset flex h-[52px] w-full items-center gap-2.5 rounded-[10px] border border-border bg-surface-secondary px-2.5 py-2 text-left text-foreground shadow-none"
const NAME = "truncate font-semibold text-[13px] leading-[1.35]"

/**
 * The account the account pages show, at the top of the side menu: its
 * profile picture in its frame, the name and the UID, masked as the setting
 * says. With two or more accounts it opens a list to the right to choose
 * another; before the first snapshot it says there is no account yet.
 */
export function AccountSwitcher() {
  const accounts = useAccountStore(s => s.accounts)
  const group = useAccountStore(s => s.group)
  const names = useAccountStore(s => s.names)
  const faces = useAccountStore(s => s.faces)
  const masked = useAppearanceStore(s => s.maskUid)
  const capture = useCaptureStore(s => s.capture)
  const live = useCaptureStore(s => liveUid(s.status))
  const noteId = useId()
  if (!group) {
    return (
      <div data-rise className="flex flex-col">
        <div className={BLOCK}>
          <span
            aria-hidden
            className="flex size-8 flex-none items-center justify-center rounded-full bg-default text-muted"
          >
            <UserRound className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={NAME}>{t.none}</span>
            <span className="truncate text-[11px] text-muted leading-[1.4]">
              {t.noneHint(capture)}
            </span>
          </span>
        </div>
        <span aria-hidden className="mx-3 my-2 h-px bg-(--separator)" />
      </div>
    )
  }
  const nameOf = (g: AccountGroup) => accountName(accounts, names, g.token) ?? ""
  const uidOf = (g: AccountGroup) =>
    g.uid === null ? text.number.missing : masked ? maskUid(g.uid) : String(g.uid)
  const timeOf = (g: AccountGroup) => {
    const newest = g.snapshots[0]
    return newest ? timeLabel(newest, g.uid !== null && g.uid === live) : text.number.missing
  }
  const name = nameOf(group)
  const face = faces[group.token]
  const avatar = (
    <span aria-hidden className="flex">
      <ProfileAvatar picture={face?.picture} frame={face?.frame} label={name} size="small" />
    </span>
  )
  const uid = (
    <span className="truncate text-[11px] text-muted leading-[1.4] tabular">
      {t.uid(uidOf(group))}
    </span>
  )

  return (
    <div data-rise className="flex flex-col">
      {accounts.length < 2 ? (
        <div className={BLOCK}>
          {avatar}
          <span className="flex min-w-0 flex-1 flex-col">
            <span title={name} className={NAME}>
              {name}
            </span>
            {uid}
          </span>
        </div>
      ) : (
        <Select
          aria-label={t.pick}
          value={group.token}
          onChange={key => {
            if (key !== null) useAccountStore.getState().selectAccount(Number(key))
          }}
          className="group"
        >
          <Select.Trigger
            className={cn(
              BLOCK,
              "cursor-pointer transition-colors duration-150 ease-out hover:bg-default/60 group-data-open:border-accent motion-reduce:transition-none",
            )}
          >
            {avatar}
            <span className="flex min-w-0 flex-1 flex-col">
              <Select.Value title={name} className={NAME}>
                {name}
              </Select.Value>
              {uid}
            </span>
            <ChevronDown
              aria-hidden
              className="size-3.5 flex-none text-muted transition-transform duration-150 ease-out group-data-open:rotate-180 motion-reduce:transition-none"
            />
          </Select.Trigger>
          {/* Beside the side menu, level with the block; blurred under glass. */}
          <Select.Popover
            placement="right top"
            offset={16}
            maxHeight={360}
            className="glass w-[360px] rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) shadow-(--pop-shadow) motion-reduce:animate-none"
          >
            <ListBox aria-describedby={capture ? noteId : undefined}>
              {accounts.map(item => {
                const itemName = nameOf(item)
                const itemFace = faces[item.token]
                return (
                  <ListBox.Item
                    key={item.token}
                    id={item.token}
                    textValue={itemName}
                    className="min-h-12 gap-2.5 rounded-[8px] text-[13px]"
                  >
                    <span aria-hidden className="flex">
                      <ProfileAvatar
                        picture={itemFace?.picture}
                        frame={itemFace?.frame}
                        label={itemName}
                        size="small"
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        title={itemName}
                        className={cn("truncate", item.token === group.token && "font-semibold")}
                      >
                        {itemName}
                      </span>
                      <span className="truncate text-[12px] text-muted tabular">
                        {t.meta(uidOf(item), timeOf(item))}
                      </span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                )
              })}
            </ListBox>
            {/* Only auto sync follows the login. */}
            {capture && (
              <>
                <span aria-hidden className="mx-2.5 mb-1.5 block h-px bg-(--separator)" />
                <p id={noteId} className="px-4 pb-3 text-[12px] text-muted leading-[1.6]">
                  {t.follows}
                </p>
              </>
            )}
          </Select.Popover>
        </Select>
      )}
      <span aria-hidden className="mx-3 my-2 h-px bg-(--separator)" />
    </div>
  )
}
