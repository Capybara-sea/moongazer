// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Eye, EyeOff } from "lucide-react"
import { type ReactNode, useState } from "react"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { maskUid } from "@/lib/format"
import { useTip } from "./Tip"

type Props = {
  uid: number | undefined
  /** Whether it starts masked; the eye shows or hides it. Not stored. */
  masked: boolean
  className?: string
  /** Size and hover look of the eye button. */
  buttonClassName?: string
  /** What follows the eye on the same line. */
  children?: ReactNode
}

/** "UID", the UID masked or shown, and the eye that switches it. */
export function UidLine({ uid, masked, className, buttonClassName, children }: Props) {
  const [shown, setShown] = useState(!masked)
  const label = shown ? text.account.hideUid : text.account.showUid
  const Icon = shown ? EyeOff : Eye
  const tip = useTip<HTMLButtonElement>(label)
  return (
    <span className={cn("flex items-center gap-1.5 tabular", className)}>
      <span>{text.account.uid}</span>
      <span key={String(shown)} data-rise>
        {uid === undefined ? text.number.missing : shown ? String(uid) : maskUid(uid)}
      </span>
      {uid !== undefined && (
        <button
          {...tip.props}
          type="button"
          aria-label={label}
          onClick={() => setShown(!shown)}
          className={cn(
            "flex flex-none cursor-pointer items-center justify-center rounded-[6px] transition-colors hover:bg-default/60 hover:text-foreground motion-reduce:transition-none",
            buttonClassName,
          )}
        >
          <Icon aria-hidden className="size-[15px]" />
          {tip.bubble}
        </button>
      )}
      {children}
    </span>
  )
}
