// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Bar } from "@/components/Bar"
import { Panel } from "@/components/Panel"
import type { Account, Anecdotes } from "@/domain/account"
import { ANECDOTES } from "@/domain/overviewData"
import { cn } from "@/lib/cn"
import { formatDateTime, formatMonthDay, formatNumber, formatTime } from "@/lib/format"
import { text } from "@/text/zh"

/** Recorded anecdotes, the seal reward's progress and the last wish, side by side in one card. */
export function AnecdoteCard({ account }: { account: Account }) {
  const anecdotes = account.anecdotes
  return (
    <section aria-label={text.anecdotes.title} className="flex flex-col gap-2.5">
      <h2 className="font-semibold text-base">{text.anecdotes.title}</h2>
      <Panel className="flex-row flex-wrap items-center gap-7 px-4.5 py-3.5">
        {anecdotes ? (
          <>
            <Recorded anecdotes={anecdotes} />
            {anecdotes.reward && <Seals {...anecdotes.reward} />}
            <LastWish at={anecdotes.lastWish} />
          </>
        ) : (
          <span className="text-[13px] text-muted">{text.snapshot.notRead}</span>
        )}
      </Panel>
    </section>
  )
}

function Recorded({ anecdotes }: { anecdotes: Anecdotes }) {
  return (
    <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">{text.anecdotes.recorded}</span>
        <span className="tabular">
          <span className="font-semibold text-[20px]">{formatNumber(anecdotes.recorded)}</span>
          <span className="text-[13px] text-muted"> / {formatNumber(ANECDOTES)}</span>
        </span>
      </div>
      <Bar value={ANECDOTES > 0 ? anecdotes.recorded / ANECDOTES : 0} />
      <span className="text-[11px] text-muted">
        {text.anecdotes.detail(anecdotes.inProgress, anecdotes.areas)}
      </span>
    </div>
  )
}

type Props = { index: number; progress: number; target: number }

function Seals({ index, progress, target }: Props) {
  return (
    <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">{text.anecdotes.seals}</span>
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
      <span className="text-[11px] text-muted">
        {text.anecdotes.sealsDetail(Math.max(target - progress, 0), index)}
      </span>
    </div>
  )
}

function LastWish({ at }: { at: number | undefined }) {
  return (
    <div className="flex min-w-0 flex-[0_1_200px] flex-col gap-1.5">
      <span className="text-[13px] text-muted">{text.anecdotes.lastWish}</span>
      {at ? (
        <span className="tabular font-semibold text-[15px]" title={formatDateTime(at)}>
          {`${formatMonthDay(at)} ${formatTime(at)}`}
        </span>
      ) : (
        <span className="font-semibold text-[15px] text-muted">{text.anecdotes.never}</span>
      )}
      <span className="text-[11px] text-muted">{text.anecdotes.lastWishNote}</span>
    </div>
  )
}
