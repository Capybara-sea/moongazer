// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ReactNode } from "react"
import { Panel } from "@/components/Panel"
import { Tip } from "@/components/Tip"
import type { Account } from "@/domain/account"
import { activity } from "@/domain/activities"
import { type CalendarItem, calendar, type Span } from "@/domain/calendar"
import { serverMonthDay } from "@/domain/gameTime"
import { formatCountdown } from "@/features/tasks/taskText"
import { cn } from "@/lib/cn"
import { formatDateTime } from "@/lib/format"
import { text } from "@/text/zh"

const h = text.home.calendar
const WEEK = 7 * 24 * 3_600_000

type Props = { account?: Account; now: number }

/**
 * The version as estimated, the challenges' periods and the events of the
 * newest snapshot, as bars across the version with a line at now. Bars that
 * run past the version are cut at its edges.
 */
export function CalendarCard({ account, now }: Props) {
  const { version, items } = calendar(account, now)
  const at = (ms: number) =>
    Math.min(1, Math.max(0, (ms - version.start) / (version.end - version.start)))
  const weeks: number[] = []
  for (let day = version.start; day < version.end; day += WEEK) weeks.push(day)
  return (
    <Panel aria-label={h.title} className="gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-semibold text-[15px]">{h.title}</h2>
        <Tip content={h.estimate} className="tabular text-[12px] text-muted">
          {h.version(serverMonthDay(version.start), serverMonthDay(version.end))}
        </Tip>
      </div>
      <div className="flex flex-col">
        <Line>
          <span aria-hidden className="relative h-5">
            {weeks.map(day => (
              <span
                key={day}
                className="tabular absolute top-0 pl-1 text-[11px] text-muted"
                style={{ left: `${at(day) * 100}%` }}
              >
                {serverMonthDay(day)}
              </span>
            ))}
          </span>
        </Line>
        {items.map(item => (
          <Row key={item.key} item={item} at={at} now={now} ticks={weeks.map(at)} />
        ))}
      </div>
    </Panel>
  )
}

/** A row's two parts: the track and the time left. */
type LineProps = { left?: string; children: ReactNode }

function Line({ left, children }: LineProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7.5em] items-stretch gap-x-3">
      {children}
      <span className="tabular self-center whitespace-nowrap text-right text-[12px] text-muted">
        {left}
      </span>
    </div>
  )
}

type RowProps = { item: CalendarItem; at: (ms: number) => number; now: number; ticks: number[] }

function Row({ item, at, now, ticks }: RowProps) {
  const name = itemName(item)
  const left =
    item.start > now ? h.starts(serverMonthDay(item.start)) : formatCountdown(item.end - now)
  const spans = [spanText(item), item.burst && `${h.burst} ${spanText(item.burst)}`]
  const when = spans.filter(Boolean).join("\n")
  const from = at(item.start)
  const to = at(item.end)
  // A name that starts late in the version is written back from the bar's end.
  const late = from > 0.6
  return (
    <Line left={left}>
      <Tip content={`${name}\n${when}`} className="relative block h-9">
        {ticks.map(tick => (
          <span
            key={tick}
            aria-hidden
            className="absolute inset-y-0 w-px bg-border"
            style={{ left: `${tick * 100}%` }}
          />
        ))}
        {to > from && (
          <span
            aria-hidden
            className="absolute inset-y-1.5 overflow-hidden rounded-md bg-accent/25"
            style={{ left: `${from * 100}%`, width: `${(to - from) * 100}%` }}
          >
            {item.burst && <Burst span={item.burst} at={at} bar={[from, to]} />}
          </span>
        )}
        <span
          className={cn(
            "absolute inset-y-0 flex items-center px-2 text-[12px]",
            late && "justify-end",
          )}
          style={
            late
              ? { right: `${(1 - to) * 100}%`, maxWidth: `${to * 100}%` }
              : { left: `${from * 100}%`, maxWidth: `${(1 - from) * 100}%` }
          }
        >
          <span className="truncate">{name}</span>
          {/* The bars only show the times, so they are written out for screen readers. */}
          <span className="sr-only">{when}</span>
        </span>
        <span
          aria-hidden
          className="absolute inset-y-0 w-0.5 rounded-full bg-foreground/50"
          style={{ left: `${at(now) * 100}%` }}
        />
      </Tip>
    </Line>
  )
}

const spanText = (span: Span) => `${formatDateTime(span.start)} – ${formatDateTime(span.end)}`

type BurstProps = { span: Span; at: (ms: number) => number; bar: [number, number] }

/** The burst within its season's bar, both as cut at the version's edges. */
function Burst({ span, at, bar: [start, end] }: BurstProps) {
  const from = (at(span.start) - start) / (end - start)
  const to = (at(span.end) - start) / (end - start)
  if (to <= from) return null
  return (
    <span
      className="absolute inset-y-0 bg-amber-400/45"
      style={{ left: `${from * 100}%`, width: `${(to - from) * 100}%` }}
    />
  )
}

function itemName(item: CalendarItem) {
  switch (item.kind) {
    case "abyss":
    case "theater":
    case "stygian":
      return text.challenges[item.kind]
    case "event": {
      const id = item.activityId ?? 0
      return activity(id).name ?? text.tasks.eventUnnamed(id)
    }
  }
}
