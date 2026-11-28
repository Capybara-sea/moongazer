// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronRight } from "lucide-react"
import { useMemo } from "react"
import { Bar } from "@/components/Bar"
import { CardHeader } from "@/components/CardHeader"
import { Panel } from "@/components/Panel"
import { Tip } from "@/components/Tip"
import type { Account } from "@/domain/account"
import { ANECDOTE_REWARD, type AnecdoteView, anecdoteView } from "@/domain/anecdotes"
import { PARTS } from "@/features/collection/parts"
import { cn } from "@/lib/cn"
import { formatDateTime, formatMonthDay, formatNumber, formatTime } from "@/lib/format"
import { navigate } from "@/lib/route"
import { text } from "@/text"

/** Recorded anecdotes, the seal reward's progress and the last wish, side by side in one card. */
export function AnecdoteCard({ account }: { account: Account }) {
  const anecdotes = account.anecdotes
  const view = useMemo(() => anecdoteView(account), [account])
  return (
    <Panel aria-label={text.anecdotes.title} className="gap-2.5">
      <CardHeader title={text.anecdotes.title}>
        <button
          type="button"
          onClick={() => navigate("collection", PARTS.anecdotes)}
          className="flex h-[30px] cursor-pointer items-center gap-0.5 rounded-[8px] pr-1 pl-2 text-(--accent-text) text-[13px] transition-colors duration-150 hover:bg-default/60 motion-reduce:transition-none"
        >
          {text.anecdotes.open}
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </CardHeader>
      <div className="flex flex-wrap items-center gap-7">
        {anecdotes && view ? (
          <>
            <Recorded view={view} />
            {view.seals.reward && <Seals {...view.seals.reward} />}
            <LastWish at={anecdotes.lastWish} />
          </>
        ) : (
          <span className="text-[13px] text-muted">{text.snapshot.notRead}</span>
        )}
      </div>
    </Panel>
  )
}

function Recorded({ view }: { view: AnecdoteView }) {
  return (
    <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">{text.anecdotes.recorded}</span>
        <span className="tabular">
          <span className="font-semibold text-[20px]">{formatNumber(view.recorded)}</span>
          <span className="text-[13px] text-muted"> / {formatNumber(view.total)}</span>
        </span>
      </div>
      <Bar value={view.total > 0 ? view.recorded / view.total : 0} />
      <span className="text-[11px] text-muted">{text.anecdotes.detail(view.waiting)}</span>
    </div>
  )
}

type Props = { claimed: number; progress: number; target: number; full: boolean }

function Seals({ claimed, progress, target, full }: Props) {
  return (
    <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-2">
          <span className="text-[13px] text-muted">{text.anecdotes.seals}</span>
          {full && (
            <span className="rounded-[6px] bg-(--gold-bg) px-1.5 py-px text-(--gold-fg) text-[11px]">
              {text.anecdotes.claimable}
            </span>
          )}
        </span>
        <span className="tabular font-semibold text-[15px]">
          {progress} / {target}
        </span>
      </div>
      <span aria-hidden className="flex h-3 items-center gap-1.25">
        {Array.from({ length: target }, (_, i) => i).map(seal => (
          <span
            key={seal}
            className={cn(
              "h-3 max-w-6 flex-1 rounded-[3px] border transition-colors duration-200 motion-reduce:transition-none",
              seal < progress ? "border-(--gold-fg) bg-(--gold-fg)" : "border-(--field-border)",
            )}
          />
        ))}
      </span>
      <span className={cn("text-[11px]", full ? "text-(--gold-fg)" : "text-muted")}>
        {text.anecdotes.sealsDetail(
          Math.max(target - progress, 0),
          claimed,
          ANECDOTE_REWARD.primogems,
        )}
      </span>
    </div>
  )
}

function LastWish({ at }: { at: number | undefined }) {
  return (
    <div className="flex min-w-0 flex-[0_1_200px] flex-col gap-1.5">
      <span className="text-[13px] text-muted">{text.anecdotes.lastWish}</span>
      {at ? (
        <Tip className="tabular font-semibold text-[15px]" content={formatDateTime(at)}>
          {`${formatMonthDay(at)} ${formatTime(at)}`}
        </Tip>
      ) : (
        <span className="font-semibold text-[15px] text-muted">{text.anecdotes.never}</span>
      )}
      <span className="text-[11px] text-muted">{text.anecdotes.lastWishNote}</span>
    </div>
  )
}
