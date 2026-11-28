// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Check, RefreshCw, RefreshCwOff } from "lucide-react"
import { useId } from "react"
import { Tip } from "@/components/Tip"
import type { TaskRow } from "@/domain/tasks"
import { cn } from "@/lib/cn"
import { formatDateTime } from "@/lib/format"
import { text } from "@/text"
import { formatCountdown, rowCountdown, rowDetail, rowName } from "./taskText"

const t = text.tasks

const CHIP = "flex-none rounded-[6px] bg-default/60 px-1.5 text-[11px] text-muted leading-[18px]"
const FADE = "transition-opacity duration-200 ease-(--ease-out-soft) motion-reduce:transition-none"

type Props = {
  row: TaskRow
  now: number
  editable: boolean
  onToggle: () => void
  onToggleJudging: () => void
}

/**
 * A task: its tick, name and what the snapshot says, a sync mark where the
 * snapshot can judge it, and the time left. While the snapshot judges it the
 * tick is locked; the mark turns that off and on. Done, it fades all but the
 * tick and the mark.
 */
export function TaskItem({ row, now, editable, onToggle, onToggleJudging }: Props) {
  const name = rowName(row)
  const detail = rowDetail(row)
  const at = rowCountdown(row)
  return (
    <li
      data-rise
      className="flex min-h-[44px] items-center gap-2.5 border-(--separator) border-t py-[5px]"
    >
      <Tick
        checked={row.done}
        label={name}
        disabled={!editable}
        locked={row.judged}
        onChange={onToggle}
      />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={cn("flex min-w-0 flex-1 flex-col", FADE, row.done && "opacity-45")}>
          <span className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <span className="break-words">{name}</span>
            {row.kind === "event" && row.tag && (
              <span className={CHIP}>{t.eventTags[row.tag]}</span>
            )}
          </span>
          {detail && (
            <span className="break-words text-[11.5px] text-muted leading-[1.35]">{detail}</span>
          )}
        </div>
        <Mark row={row} name={name} editable={editable} onToggle={onToggleJudging} />
        {at !== undefined && (
          <Tip
            content={formatDateTime(at)}
            className={cn(
              "tabular flex-none whitespace-nowrap text-[11.5px] text-muted",
              FADE,
              row.done && "opacity-45",
            )}
          >
            {formatCountdown(at - now)}
          </Tip>
        )}
      </div>
    </li>
  )
}

type MarkProps = { row: TaskRow; name: string; editable: boolean; onToggle: () => void }

/**
 * Where the snapshot can judge a task: a sync mark, slashed once judging is
 * turned off. With the means to save, a click turns judging off or back on.
 * Its spoken name says which task, as the rows' marks look alike.
 */
function Mark({ row, name, editable, onToggle }: MarkProps) {
  if (row.auto !== "done" && row.auto !== "notDone") return null
  const Icon = row.judged ? RefreshCw : RefreshCwOff
  if (!editable) {
    const label = row.judged ? t.auto : t.autoOff
    return (
      <Tip content={label} className="flex flex-none text-muted">
        <Icon aria-hidden size={12} />
        <span className="sr-only">{t.markLabel(name, label)}</span>
      </Tip>
    )
  }
  const label = row.judged ? t.autoTip : t.autoOffTip
  return (
    <Tip content={label} className="contents">
      <button
        type="button"
        aria-label={t.markLabel(name, label)}
        onClick={onToggle}
        className="-m-1 flex flex-none cursor-pointer rounded-[6px] p-1 text-muted transition-colors duration-150 ease-(--ease-out-soft) hover:bg-default/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
      >
        <Icon aria-hidden size={12} />
      </button>
    </Tip>
  )
}

type TickProps = {
  checked: boolean
  label: string
  disabled: boolean
  locked: boolean
  onChange: () => void
}

/**
 * A round tick. Locked while the snapshot judges the task, it only shows what
 * the snapshot says, faded, and says how to tick by hand; without the means to
 * save it only shows too, and the card says why.
 */
function Tick({ checked, label, disabled, locked, onChange }: TickProps) {
  const off = disabled || locked
  const hint = useId()
  const explained = locked && !disabled
  const tick = (
    <label
      className={cn(
        "relative flex size-5 flex-none items-center justify-center rounded-full border-2 transition-[color,background-color,border-color,opacity] duration-150 ease-(--ease-out-soft) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2 motion-reduce:transition-none",
        checked ? "border-accent bg-accent text-accent-foreground" : "border-(--field-border)",
        off ? "cursor-default" : "cursor-pointer",
        !off && !checked && "hover:border-accent",
        locked && "opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={off}
        aria-label={label}
        aria-describedby={explained ? hint : undefined}
        onChange={onChange}
        className="sr-only"
      />
      {explained && (
        <span id={hint} className="sr-only">
          {t.lockedTick}
        </span>
      )}
      <Check
        aria-hidden
        size={12}
        strokeWidth={3}
        className={cn(
          "transition-opacity duration-150 motion-reduce:transition-none",
          checked ? "opacity-100" : "opacity-0",
        )}
      />
    </label>
  )
  return explained ? (
    <Tip content={t.lockedTick} className="contents">
      {tick}
    </Tip>
  ) : (
    tick
  )
}
