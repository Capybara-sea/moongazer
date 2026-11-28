// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button, Popover } from "@heroui/react"
import {
  Bell,
  BellOff,
  CircleX,
  Clock,
  type LucideIcon,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { useNow } from "@/lib/useNow"
import { useAccountName } from "@/stores/accountStore"
import { type Message, type MessageKind, useMessageStore } from "@/stores/messageStore"
import { useUpdateStore } from "@/stores/updateStore"
import { text } from "@/text"
import { messageGroups, messageTime } from "./groups"
import { openTarget } from "./target"

const t = text.messages

const LOOKS: Record<MessageKind, { Icon: LucideIcon; className: string }> = {
  remind: {
    Icon: Clock,
    className: "text-(--info) bg-[color-mix(in_srgb,var(--info)_16%,transparent)]",
  },
  update: {
    Icon: RefreshCw,
    className: "text-(--info) bg-[color-mix(in_srgb,var(--info)_16%,transparent)]",
  },
  warn: {
    Icon: TriangleAlert,
    className: "text-(--warn) bg-[color-mix(in_srgb,var(--warn)_16%,transparent)]",
  },
  danger: {
    Icon: CircleX,
    className: "text-(--err) bg-[color-mix(in_srgb,var(--err)_16%,transparent)]",
  },
}

/**
 * The title bar's bell, with a red dot while there are messages not yet seen;
 * it rings once when one arrives with the list closed. It opens the list.
 */
export function MessageCenter() {
  const open = useMessageStore(s => s.open)
  const unseen = useMessageStore(s => !s.open && s.lastSeq > s.seen)
  const rings = useMessageStore(s => s.rings)
  return (
    <div className="flex items-stretch">
      <Popover isOpen={open} onOpenChange={next => useMessageStore.getState().setOpen(next)}>
        <Button
          variant="ghost"
          isIconOnly
          aria-label={unseen ? t.bellUnread : t.bell}
          className={cn(
            "relative h-full w-10 min-w-0 rounded-none text-foreground",
            open && "bg-(--accent-soft)",
          )}
        >
          {/* A new key restarts the swing for each message; none before the first. */}
          <Bell
            key={rings}
            aria-hidden
            strokeWidth={1.75}
            className={cn(
              "size-[15px] origin-[50%_3px]",
              rings > 0 && "animate-[bell-ring_0.8s_ease-in-out] motion-reduce:animate-none",
            )}
          />
          {unseen && (
            <span
              aria-hidden
              className="absolute top-[7px] left-[22px] size-[7px] rounded-full bg-(--err) shadow-[0_0_0_2px_var(--background)]"
            />
          )}
        </Button>
        <Popover.Content
          placement="bottom end"
          offset={6}
          // Under glass the panel lets the blurred page show through; otherwise it is solid.
          className="glass w-[380px] overflow-hidden rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
        >
          <Popover.Dialog
            aria-label={t.bell}
            className="flex max-h-[min(620px,calc(100vh-56px))] flex-col p-0 outline-none"
          >
            <MessageList />
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      <span aria-hidden className="mx-1.5 my-[9px] w-px bg-(--separator)" />
    </div>
  )
}

function MessageList() {
  const messages = useMessageStore(s => s.messages)
  const shownFrom = useMessageStore(s => s.shownFrom)
  const now = useNow()
  const groups = messageGroups(messages, now)
  return (
    <>
      <div className="flex h-11 flex-none items-center justify-between border-(--separator) border-b pr-2.5 pl-4">
        <span className="font-semibold text-[14px]">{t.title}</span>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => useMessageStore.getState().clear()}
            className="h-[26px] cursor-pointer rounded-[6px] px-2 text-[12px] text-muted hover:bg-surface-secondary"
          >
            {t.clear}
          </button>
        )}
      </div>
      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-14 text-[13px] text-muted">
          <BellOff aria-hidden className="size-[22px]" strokeWidth={1.75} />
          {t.empty}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-1.5">
          {groups.map(group => (
            <section key={group.label} aria-label={group.label}>
              <h3 className="px-4 pt-2.5 pb-0.5 font-normal text-[11px] text-muted tracking-[0.04em]">
                {group.label}
              </h3>
              {group.messages.map(message => (
                <Item
                  key={message.id}
                  message={message}
                  fresh={message.seq > shownFrom}
                  now={now}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function Item({ message, fresh, now }: { message: Message; fresh: boolean; now: number }) {
  const { Icon, className } = LOOKS[message.kind]
  const account = useAccountName(message.account)
  return (
    <div className="relative px-2">
      <button
        type="button"
        onClick={() => {
          useMessageStore.getState().setOpen(false)
          openTarget(message.page, message.account)
        }}
        className="flex w-full cursor-pointer gap-2.5 rounded-[8px] p-2 text-left hover:bg-surface-secondary"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-[30px] flex-none items-center justify-center rounded-[8px]",
            className,
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 font-semibold text-[13px] leading-[19px]">
              {fresh && <span className="sr-only">{t.fresh}</span>}
              {message.title}
              {account && (
                <span className="font-normal text-[12px] text-muted">{t.ofAccount(account)}</span>
              )}
            </span>
            <span className="tabular flex-none text-[11px] text-muted">
              {messageTime(message.at, now)}
            </span>
          </span>
          <span className="text-[12px] text-muted leading-[18px]">{message.body}</span>
        </span>
      </button>
      {fresh && (
        <span aria-hidden className="absolute top-[21px] left-1 size-1.5 rounded-full bg-accent" />
      )}
      {message.action && <Action action={message.action} />}
    </div>
  )
}

/** A message's button, while what it acts on is still there: the update is downloaded or found. */
function Action({ action }: { action: NonNullable<Message["action"]> }) {
  const status = useUpdateStore(s => s.status)
  const live = action === "restart" ? status === "ready" : status === "available"
  if (!live) return null
  return (
    <div className="pb-2 pl-12">
      <button
        type="button"
        onClick={() => {
          useMessageStore.getState().setOpen(false)
          void useUpdateStore.getState().install()
        }}
        className="h-7 cursor-pointer rounded-[7px] border border-accent bg-accent px-2.5 font-semibold text-(--on-accent) text-[12px]"
      >
        {action === "restart" ? text.update.restart : text.update.openPageShort}
      </button>
    </div>
  )
}
