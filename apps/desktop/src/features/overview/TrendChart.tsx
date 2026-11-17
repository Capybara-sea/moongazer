// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { type MouseEvent, useMemo, useState } from "react"
import { LabeledSelect } from "@/components/LabeledSelect"
import { Panel } from "@/components/Panel"
import type { Snapshot } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { formatAmount, formatDelta, formatNumber } from "@/lib/format"
import { useNow } from "@/lib/useNow"
import { text } from "@/text/zh"
import {
  type Bucket,
  bucketLabel,
  buildBuckets,
  type Currency,
  changeBars,
  labelBuckets,
  type Mode,
  PLOT_HEIGHT,
  PLOT_WIDTH,
  plotSeries,
  type Range,
} from "./trend"

const MODES: Mode[] = ["snapshot", "hour", "day", "month", "year"]
const CURRENCIES: Currency[] = ["mora", "primogems"]
const RANGES: Range[] = [7, 30, 90, "all"]
const HOUR_RANGES: Range[] = [7]
/** The change bars' strip, in px. */
const STRIP = 60
const GRID = [0.5, 50.5, 99.5, 149.5].map(y => `M0 ${y}H${PLOT_WIDTH}`).join("")
const MOTION = "duration-150 ease-(--ease-out-soft) motion-reduce:transition-none"

const SERIES = {
  mora: {
    label: text.tiles.mora,
    format: formatAmount,
    fill: "fill-(--c-mora)",
    stroke: "stroke-(--c-mora)",
    bg: "bg-(--c-mora)",
  },
  primogems: {
    label: text.tiles.primogems,
    format: formatNumber,
    fill: "fill-(--c-primo)",
    stroke: "stroke-(--c-primo)",
    bg: "bg-(--c-primo)",
  },
} as const

/** Mora and Primogems over time. Only summaries are used, so the whole history counts. */
export function TrendChart({ snapshots }: { snapshots: Snapshot[] }) {
  const [mode, setMode] = useState<Mode>("day")
  const [range, setRange] = useState<Range>(30)
  /** The hovered bucket's start, shared by both charts. */
  const [hover, setHover] = useState<number | null>(null)
  const now = useNow()
  const buckets = useMemo(
    () => ({
      mora: buildBuckets(snapshots, "mora", mode, range, now),
      primogems: buildBuckets(snapshots, "primogems", mode, range, now),
    }),
    [snapshots, mode, range, now],
  )
  const hasData = snapshots.some(s => s.summary.mora !== null || s.summary.primogems !== null)
  const ranged = mode !== "month" && mode !== "year"
  const shownRange = mode === "hour" ? 7 : range

  return (
    <Panel aria-label={text.trend.title} className="gap-4 px-4.5 pt-4 pb-4.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-base">{text.trend.title}</h2>
        {hasData && (
          <div className="flex flex-wrap items-center gap-2">
            <fieldset
              aria-label={text.trend.granularity}
              className="flex gap-0.5 rounded-[9px] bg-surface-secondary p-[3px]"
            >
              {MODES.map(option => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={option === mode}
                  onClick={() => {
                    setMode(option)
                    setHover(null)
                  }}
                  className={cn(
                    "h-[30px] cursor-pointer rounded-[7px] px-[11px] text-[13px] transition-colors",
                    MOTION,
                    option === mode
                      ? "bg-surface font-semibold text-foreground [box-shadow:var(--shadow),inset_0_0_0_1px_var(--border)]"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {text.trend.modes[option]}
                </button>
              ))}
            </fieldset>
            {ranged && (
              <LabeledSelect
                label={text.trend.range}
                value={String(shownRange)}
                options={(mode === "hour" ? HOUR_RANGES : RANGES).map(r => ({
                  value: String(r),
                  label: text.trend.ranges[r],
                }))}
                onChange={value => {
                  const picked = RANGES.find(r => String(r) === value)
                  if (picked !== undefined) setRange(picked)
                  setHover(null)
                }}
              />
            )}
          </div>
        )}
      </div>
      {buckets.mora.length === 0 && buckets.primogems.length === 0 ? (
        <p className="text-[13px] text-muted">
          {hasData ? text.trend.emptyRange : text.trend.empty}
        </p>
      ) : (
        // Keyed by what is shown, so switching rises in fresh instead of the lines jumping.
        // biome-ignore lint/a11y/noStaticElementInteractions: hovering only highlights a bucket; every value is also text
        <div
          key={ranged ? `${mode}:${shownRange}` : mode}
          data-rise
          onMouseLeave={() => setHover(null)}
          className="flex flex-wrap gap-6"
        >
          {CURRENCIES.map(currency => (
            <SeriesChart
              key={currency}
              currency={currency}
              buckets={buckets[currency]}
              mode={mode}
              hover={hover}
              onHover={setHover}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

type ChartProps = {
  currency: Currency
  buckets: Bucket[]
  mode: Mode
  /** The hovered bucket's start, or null for the latest. */
  hover: number | null
  onHover: (at: number) => void
}

/** One currency: its value, a stepped line with its area, and each bucket's change as a bar. */
function SeriesChart({ currency, buckets, mode, hover, onHover }: ChartProps) {
  const series = SERIES[currency]
  const n = buckets.length
  const hovered = hover === null ? -1 : buckets.findIndex(b => b.at === hover)
  const index = hovered === -1 ? n - 1 : hovered
  const current = buckets[index]
  if (!current) return null
  const plot = plotSeries(buckets)
  const strip = changeBars(buckets)
  const dot = plot.point(index)
  const delta = hovered === -1 ? buckets.reduce((sum, b) => sum + b.delta, 0) : current.delta
  // Columns worked out from the pointer, not an element each: hour mode has 168 of them.
  const pick = (event: MouseEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const column = Math.floor(((event.clientX - box.left) / box.width) * n)
    const bucket = buckets[Math.min(Math.max(column, 0), n - 1)]
    if (bucket) onHover(bucket.at)
  }
  // Narrower gaps between many bars, so the gaps alone never outgrow the strip.
  const gap = n <= 60 ? 2 : n <= 120 ? 1 : 0

  return (
    <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-[15px]">
          <span aria-hidden className={cn("size-2.5 rounded-[3px]", series.bg)} />
          {series.label}
        </h3>
        <span className="tabular flex items-baseline gap-2">
          <span className="text-[12px] text-muted">
            {hovered === -1 ? text.trend.latest : bucketLabel(current.at, mode)}
          </span>
          <span className="font-semibold text-base">{series.format(current.value)}</span>
          <span className={cn("text-[12px]", delta > 0 ? "text-(--accent-text)" : "text-muted")}>
            {hovered === -1 ? text.trend.inRange(formatDelta(delta)) : formatDelta(delta)}
          </span>
        </span>
      </div>
      <div className="flex gap-2">
        <div className="tabular flex h-[150px] w-[52px] flex-none flex-col items-end justify-between text-[11px] text-muted">
          {plot.ticks.map(tick => (
            <span key={tick} className="leading-none">
              {series.format(tick)}
            </span>
          ))}
        </div>
        {/* Its width (cqw) lets the dot and the cross line move by transform, which can glide. */}
        <div
          aria-hidden
          className="@container relative h-[150px] min-w-0 flex-1"
          onMouseMove={pick}
        >
          <svg
            aria-hidden="true"
            width="100%"
            height={PLOT_HEIGHT}
            viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
            preserveAspectRatio="none"
            className="block overflow-visible"
          >
            <path
              d={GRID}
              className="fill-none stroke-(--separator)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <path d={plot.area} className={series.fill} fillOpacity={0.16} />
            <path
              d={plot.line}
              className={cn("fill-none", series.stroke)}
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 w-px bg-muted transition-[opacity,transform]",
              MOTION,
              hovered === -1 ? "opacity-0" : "opacity-60",
            )}
            style={{ transform: `translateX(${dot.x * 100}cqw)` }}
          />
          <span
            className={cn(
              "pointer-events-none absolute top-0 left-0 size-2.5 rounded-full border-2 border-background transition-transform",
              MOTION,
              series.bg,
            )}
            style={{
              transform: `translate(calc(${dot.x * 100}cqw - 5px), ${dot.y * PLOT_HEIGHT - 5}px)`,
            }}
          />
        </div>
      </div>
      <div className="flex items-baseline justify-between pl-[60px] text-[12px] text-muted">
        <span>{text.trend.change[mode]}</span>
        <span className="tabular">{text.trend.max(formatDelta(strip.gain))}</span>
      </div>
      <div className="flex gap-2">
        <div className="w-[52px] flex-none" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div
            aria-hidden
            className="relative flex h-[60px]"
            style={{ columnGap: gap }}
            onMouseMove={pick}
          >
            <span
              className="absolute inset-x-0 h-px bg-(--separator)"
              style={{ top: Math.min(strip.zero * STRIP, STRIP - 1) }}
            />
            {strip.bars.map((bar, i) => (
              <span
                key={bar.at}
                className={cn(
                  "relative min-w-0 flex-1 self-start transition-opacity",
                  MOTION,
                  series.bg,
                  bar.loss ? "rounded-b-[3px]" : "rounded-t-[3px]",
                )}
                style={{
                  marginTop: bar.top * STRIP,
                  height: bar.height * STRIP,
                  opacity: (bar.loss ? 0.5 : 1) * (hovered === -1 || hovered === i ? 1 : 0.4),
                }}
              />
            ))}
          </div>
          <div className="tabular flex justify-between text-[11px] text-muted">
            {labelBuckets(buckets).map(bucket => (
              <span key={bucket.at}>{bucketLabel(bucket.at, mode)}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
