// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Check, UserRound } from "lucide-react"
import type { ReactNode } from "react"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import type { Tone } from "@/components/StatusDot"
import { Tip } from "@/components/Tip"
import { type AccountGroup, liveUid, timeLabel } from "@/domain/accounts"
import { cn } from "@/lib/cn"
import { formatDateTime, maskUid } from "@/lib/format"
import { accountName, useAccountStore } from "@/stores/accountStore"
import { useAppearanceStore } from "@/stores/appearanceStore"
import { syncOn, useCaptureStore } from "@/stores/captureStore"
import { text } from "@/text/zh"

const t = text.accounts

const DOT: Record<Tone, string> = {
  ok: "bg-(--ok)",
  warn: "bg-(--warn)",
  bad: "bg-(--err)",
  idle: "bg-(--off)",
}

function useUidText() {
  const masked = useAppearanceStore(s => s.maskUid)
  return (g: AccountGroup) =>
    g.uid === null ? text.number.missing : masked ? maskUid(g.uid) : String(g.uid)
}

/** The account the pages show: its name, and its UID for a line under it. */
export function useShownAccount() {
  const accounts = useAccountStore(s => s.accounts)
  const group = useAccountStore(s => s.group)
  const names = useAccountStore(s => s.names)
  const uidText = useUidText()
  if (!group) return null
  return {
    group,
    name: accountName(accounts, names, group.token) ?? "",
    uid: t.uid(uidText(group)),
  }
}

type FaceProps = {
  /** Auto sync's state as a dot on the picture; none without auto sync. */
  tone: Tone | null
  /** The line under the name; the account's UID, or before the first snapshot what to do. */
  line?: ReactNode
  /** Shows the open arrow. */
  trailing?: ReactNode
}

/**
 * The shown account's picture in its frame, with auto sync's dot in its
 * corner, the name and a line; before the first snapshot, a placeholder that
 * says there is no account yet.
 */
export function AccountFace({ tone, line, trailing }: FaceProps) {
  const shown = useShownAccount()
  const faces = useAccountStore(s => s.faces)
  const capture = useCaptureStore(s => s.capture)
  const on = useCaptureStore(syncOn)
  const face = shown ? faces[shown.group.token] : undefined
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className="relative flex flex-none">
        {shown ? (
          <ProfileAvatar
            picture={face?.picture}
            frame={face?.frame}
            label={shown.name}
            size="small"
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-default text-muted">
            <UserRound className="size-4" />
          </span>
        )}
        {tone && (
          <span
            className={cn(
              "absolute -right-px -bottom-px size-2.5 rounded-full shadow-[0_0_0_2px_var(--surface-secondary)] transition-colors duration-200 motion-reduce:transition-none",
              DOT[tone],
            )}
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <Tip content={shown?.name} className="truncate font-semibold text-[13px] leading-[1.35]">
          {shown ? shown.name : t.none}
        </Tip>
        <span className="truncate text-[11px] text-muted leading-[1.4] tabular">
          {line ?? (shown ? shown.uid : t.noneHint(capture, on))}
        </span>
      </span>
      {trailing}
    </span>
  )
}

/**
 * Every account, the shown one in bold with a check and the one auto sync
 * reads tagged; picking one shows it and closes the panel.
 */
export function AccountList() {
  const accounts = useAccountStore(s => s.accounts)
  const group = useAccountStore(s => s.group)
  const names = useAccountStore(s => s.names)
  const faces = useAccountStore(s => s.faces)
  const capture = useCaptureStore(s => s.capture)
  const live = useCaptureStore(s => liveUid(s.status))
  const uidText = useUidText()
  return (
    <div className="flex flex-col gap-0.5 p-3 pb-1.5">
      <span className="px-2.5 pb-1 text-[11px] text-muted tracking-[0.08em]">{t.title}</span>
      <ul aria-label={t.pick} className="flex flex-col gap-0.5">
        {accounts.map(item => {
          const name = accountName(accounts, names, item.token) ?? ""
          const face = faces[item.token]
          const current = item.token === group?.token
          const syncing = item.uid !== null && item.uid === live
          const newest = item.snapshots[0]
          return (
            <li key={item.token}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => {
                  useAccountStore.getState().selectAccount(item.token)
                  useCaptureStore.getState().setPanelOpen(false)
                }}
                className={cn(
                  "flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] transition-colors duration-150 motion-reduce:transition-none",
                  current ? "bg-(--accent-soft)" : "hover:bg-default/60",
                )}
              >
                <span aria-hidden className="flex">
                  <ProfileAvatar
                    picture={face?.picture}
                    frame={face?.frame}
                    label={name}
                    size="small"
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Tip content={name} className={cn("truncate", current && "font-semibold")}>
                      {name}
                    </Tip>
                    {syncing && (
                      <span className="flex-none rounded-full bg-[color-mix(in_srgb,var(--ok)_20%,transparent)] px-1.5 text-(--ok) text-[10px] leading-4">
                        {t.syncing}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-[11px] text-muted tabular">
                    {t.meta(
                      uidText(item),
                      // The tag says it is read live; the time stays a time.
                      !newest
                        ? text.number.missing
                        : syncing
                          ? formatDateTime(newest.takenAt)
                          : timeLabel(newest),
                    )}
                  </span>
                </span>
                {current && <Check aria-hidden className="size-4 flex-none text-(--accent-text)" />}
              </button>
            </li>
          )
        })}
      </ul>
      {/* Only auto sync follows the login. */}
      {capture && <p className="px-2.5 pt-1 text-[11px] text-muted">{t.follows}</p>}
    </div>
  )
}
