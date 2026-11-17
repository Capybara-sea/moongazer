// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronLeft, ChevronRight } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { Panel } from "@/components/Panel"
import type { Snapshot } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { formatAmount, formatDelta, formatMonthDay, formatNumber } from "@/lib/format"
import { text } from "@/text/zh"
import { type Cell, monthBounds, monthRows } from "./month"

const COLUMNS =
  "grid grid-cols-[64px_minmax(110px,1fr)_minmax(130px,1fr)_minmax(170px,1.4fr)_minmax(110px,1fr)] gap-3"

/** Day by day in one month: Primogems, Mora, 4★ and 3★ artifacts and Sanctifying Essence. */
export function MonthTable({ snapshots }: { snapshots: Snapshot[] }) {
  const bounds = useMemo(() => monthBounds(snapshots), [snapshots])
  /** null follows the newest snapshot's month. */
  const [picked, setPicked] = useState<number | null>(null)
  const first = bounds?.first ?? 0
  const last = bounds?.last ?? 0
  const month = Math.min(Math.max(picked ?? last, first), last)
  const rows = useMemo(() => monthRows(snapshots, month), [snapshots, month])
  if (!bounds) return null

  return (
    <Panel aria-label={text.month.title} className="gap-3 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-base">{text.month.title}</h2>
        <div className="flex items-center gap-1">
          <StepButton
            label={text.month.previous}
            disabled={month <= first}
            onClick={() => setPicked(month - 1)}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </StepButton>
          <span className="tabular min-w-24 text-center font-medium text-sm">
            {text.month.label(Math.floor(month / 12), (month % 12) + 1)}
          </span>
          <StepButton
            label={text.month.next}
            disabled={month >= last}
            onClick={() => setPicked(month + 1)}
          >
            <ChevronRight aria-hidden className="size-4" />
          </StepButton>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">{text.month.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px] text-[13px]">
            <div
              className={cn(
                COLUMNS,
                "glass-inset rounded-[8px] bg-surface-secondary px-2.5 py-2 text-[12px] text-muted",
              )}
            >
              <span>{text.month.date}</span>
              <span>{text.month.primogems}</span>
              <span>{text.month.mora}</span>
              <span>{text.month.lowArtifacts}</span>
              <span>{text.month.essence}</span>
            </div>
            {rows.map(row => (
              <div
                key={row.day}
                data-rise
                className={cn(COLUMNS, "tabular border-(--separator) border-b p-2.5")}
              >
                <span className="font-medium">{formatMonthDay(row.day)}</span>
                <Value cell={row.primogems} format={formatNumber} />
                <Value cell={row.mora} format={formatAmount} />
                <LowArtifacts four={row.artifacts4} three={row.artifacts3} />
                <Value cell={row.essence} format={formatNumber} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}

type StepProps = {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}

function StepButton({ label, disabled, onClick, children }: StepProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 cursor-pointer items-center justify-center rounded-[8px] text-muted transition-[color,background-color,opacity] duration-150 enabled:hover:bg-default/60 enabled:hover:text-foreground disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none"
    >
      {children}
    </button>
  )
}

function Delta({ value }: { value: number }) {
  return (
    <span className={cn("text-[12px]", value > 0 ? "text-(--accent-text)" : "text-muted")}>
      {formatDelta(value)}
    </span>
  )
}

function Value({ cell, format }: { cell: Cell | null; format: (n: number) => string }) {
  if (!cell) return <span className="text-muted">{text.month.none}</span>
  return (
    <span>
      {format(cell.value)} {cell.delta !== null && <Delta value={cell.delta} />}
    </span>
  )
}

/** "52×4★ · 76×3★" with "+6 · +9", or a single 0 when neither changed. */
function LowArtifacts({ four, three }: { four: Cell | null; three: Cell | null }) {
  if (!four || !three) return <span className="text-muted">{text.month.none}</span>
  const value = text.month.lowArtifactsValue(formatNumber(four.value), formatNumber(three.value))
  if (four.delta === null || three.delta === null) return <span>{value}</span>
  return (
    <span>
      {value}{" "}
      {four.delta === 0 && three.delta === 0 ? (
        <Delta value={0} />
      ) : (
        <>
          <Delta value={four.delta} />
          <span className="text-[12px] text-muted"> · </span>
          <Delta value={three.delta} />
        </>
      )}
    </span>
  )
}
