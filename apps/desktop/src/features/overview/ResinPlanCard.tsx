// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { Bar } from "@/components/Bar"
import { CardHeader } from "@/components/CardHeader"
import { Panel } from "@/components/Panel"
import { Segmented } from "@/components/Segmented"
import { Tip } from "@/components/Tip"
import type { Account } from "@/domain/account"
import { isUnknown } from "@/domain/customCharacter"
import { currentBosses, projectResin, RESIN_CAP } from "@/domain/daily"
import { gameWeekday } from "@/domain/gameTime"
import { materialData } from "@/domain/names"
import type { MaterialTotal } from "@/domain/plan"
import { BURST_MODES, burstFor, resinState } from "@/domain/resinPlan"
import { farmToday, farmTomorrow } from "@/domain/today"
import { cellLabel, lineView, MaterialIcon } from "@/features/planner/MaterialCell"
import { usePlannerCards } from "@/features/planner/usePlannerCards"
import { formatCountdown } from "@/features/tasks/taskText"
import { cn } from "@/lib/cn"
import { formatNumber } from "@/lib/format"
import { navigate } from "@/lib/route"
import { usePlannerStore } from "@/stores/plannerStore"
import { text } from "@/text/zh"
import { useBurstMode } from "./burstMode"
import { blossomText, freeText, shortBySource, tomorrowLine } from "./resinText"

const r = text.resinPlan
const SEPARATOR = text.tasks.detail.separator
const SUNDAY = 6
/** Icons a row shows before it counts the rest. */
const MAX_ICONS = 8

type Props = { account: Account; takenAt: number; now: number }

/**
 * Where to spend resin, a row a place, in the player's order: the Stygian
 * Onslaught burst while it runs (all on it fades the rest, as able to wait),
 * the weekly bosses, then where the plan's
 * short materials drop (today's domains, the world bosses, the ley line
 * blossoms) and what costs no resin, then the training event's count. The resin there is
 * heads the card.
 */
export function ResinPlanCard({ account, takenAt, now }: Props) {
  const { uid, plan, ready, failed, totals } = usePlannerCards()
  const error = usePlannerStore(s => s.error)
  const [mode, setMode] = useBurstMode()
  // No plan to read: no UID to keep one by, or it could not be read.
  const blocked =
    uid === null ? text.planner.noUidDetail : failed ? r.planFailed(error ?? "") : undefined
  const planned = ready && !blocked && plan.goals.some(goal => !goal.off)
  const bosses = account.tasks?.weeklyBosses
  const left = bosses && currentBosses(bosses, takenAt, now).left
  const burst = burstFor(account, now)
  const deferred = burst !== undefined && mode === "all"
  const { items, training } = resinState(account, now)
  const resin = account.tasks?.resin && projectResin(account.tasks.resin, now)
  const short = shortBySource(totals)
  const weekly = planned ? short.weeklyBoss : []
  return (
    <Panel aria-label={r.title} className="min-w-0 flex-[1_1_380px] gap-0 px-[18px] pt-3.5 pb-2">
      <CardHeader title={r.title}>
        <span className="tabular text-[12px] text-muted">
          {resin
            ? r.original(resin.value, RESIN_CAP)
            : `${text.daily.resin} ${text.snapshot.notRead}`}
        </span>
      </CardHeader>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3.5">
        {items.length > 0 && (
          <Row label={r.items}>
            <span className="tabular text-[13px]">
              {items.map(item => r.item(materialData(item.key).name, item.count)).join(SEPARATOR)}
            </span>
          </Row>
        )}
        {burst && (
          <Row
            label={r.burst.title}
            tip={r.burst[mode]}
            value={r.burst.left(formatCountdown(burst.end - now))}
          >
            {/* The note goes under the switch: in the value column its length would move the bars. */}
            <span className="flex flex-col items-start gap-1">
              <Segmented
                label={r.burst.modesLabel}
                value={mode}
                options={BURST_MODES.map(value => ({ value, label: r.burst.modes[value] }))}
                onPick={setMode}
                className="w-fit"
              />
              <span className="text-[11px] text-muted leading-tight">{r.burst.notes[mode]}</span>
            </span>
          </Row>
        )}
        {/* All on the burst: what comes after can wait till it ends, so it fades. */}
        <div
          className={cn(
            "col-span-full grid grid-cols-subgrid transition-opacity duration-200 ease-(--ease-out-soft) motion-reduce:transition-none",
            deferred && "opacity-45",
          )}
        >
          {(weekly.length > 0 || (left !== undefined && left > 0)) && (
            <Row
              label={r.places.weekly}
              value={weekly.length > 0 ? r.short(weekly.length) : undefined}
              note={
                weekly.length > 0 && left !== undefined
                  ? left > 0
                    ? r.weeklyLeft(left)
                    : r.weeklyNone
                  : undefined
              }
            >
              {weekly.length > 0 ? (
                <Icons totals={weekly} />
              ) : (
                left !== undefined && <span className="text-[13px]">{r.weeklyLeft(left)}</span>
              )}
            </Row>
          )}
          {planned ? (
            <PlanRows short={short} totals={totals} weekday={gameWeekday(now)} />
          ) : (
            (blocked || ready) && (
              <Row label={r.places.plan}>
                {blocked ? (
                  <span className="text-[12px] text-muted">{blocked}</span>
                ) : plan.goals.length > 0 ? (
                  <span className="text-[12px] text-muted">{r.allOff}</span>
                ) : (
                  <NoPlan />
                )}
              </Row>
            )
          )}
        </div>
        {training && (
          <Row
            label={r.training.title}
            tip={r.training.tip}
            value={r.training.value(training.spent, training.goal)}
          >
            <Bar value={Math.min(1, training.spent / training.goal)} className="flex-1" />
          </Row>
        )}
      </div>
    </Panel>
  )
}

type PlanRowsProps = {
  short: ReturnType<typeof shortBySource>
  totals: ReadonlyMap<string, MaterialTotal>
  weekday: number
}

/**
 * Where the plan's short materials drop: today's domains (what opens tomorrow
 * when none of today's is short), the world bosses, the ley line blossoms,
 * and what costs no resin; a row each that has anything, else that all is there.
 */
function PlanRows({ short, totals, weekday }: PlanRowsProps) {
  const open = farmToday(totals, weekday)
  const tomorrow = open.length === 0 && weekday !== SUNDAY ? farmTomorrow(totals, weekday) : []
  const blossoms = blossomText(short)
  const free = freeText(short)
  const rows: ReactNode[] = []
  if (open.length > 0) {
    rows.push(
      <Row
        key="domains"
        label={r.places.domains}
        tip={weekday === SUNDAY ? text.planner.sunday : undefined}
        value={r.short(open.length)}
      >
        <Icons totals={open} />
      </Row>,
    )
  } else if (tomorrow.length > 0) {
    rows.push(
      <Row key="domains" label={r.places.domains}>
        <span className="text-[12px] text-muted">{tomorrowLine(tomorrow)}</span>
      </Row>,
    )
  }
  if (short.worldBoss.length > 0) {
    rows.push(
      <Row key="worldBoss" label={r.places.worldBoss} value={r.short(short.worldBoss.length)}>
        <Icons totals={short.worldBoss} />
      </Row>,
    )
  }
  if (blossoms) {
    rows.push(
      <Row key="blossoms" label={r.places.blossoms}>
        <span className="text-[13px]">{blossoms}</span>
      </Row>,
    )
  }
  if (free) {
    rows.push(
      <Row key="free" label={r.places.free}>
        <span className="text-[13px] text-muted">{free}</span>
      </Row>,
    )
  }
  if (rows.length === 0 && short.weeklyBoss.length === 0) {
    const anyShort = [...totals.values()].some(
      total => !isUnknown(total.key) && total.have < total.need,
    )
    return (
      <Row label={r.places.plan}>
        <span className="text-[12px] text-muted">{anyShort ? r.notToday : r.enough}</span>
      </Row>
    )
  }
  return rows
}

/** With no goals yet, what the card would show and the way to the planner. */
function NoPlan() {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-[12px] text-muted">{r.noPlan}</span>
      <button
        type="button"
        onClick={() => navigate("planner")}
        className="flex h-7 cursor-pointer items-center gap-0.5 rounded-[8px] pr-1 pl-1.5 text-(--accent-text) text-[13px] transition-colors duration-150 hover:bg-default/60 motion-reduce:transition-none"
      >
        {r.openPlanner}
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </span>
  )
}

type RowProps = {
  label: string
  value?: string
  /** Small text under the value. */
  note?: string
  /** Hover text for the label and the value, which say what the row is about. */
  tip?: string
  children?: ReactNode
}

/** A place: its name, what to get there, and how many kinds are short; as the daily card's rows. */
function Row({ label, value, note, tip, children }: RowProps) {
  return (
    <div className="col-span-full grid min-h-[46px] grid-cols-subgrid items-center border-(--separator) border-t py-1.5 text-[13px]">
      <Tip content={tip} className="whitespace-nowrap text-muted">
        {label}
      </Tip>
      <span className="flex min-w-0 items-center">{children}</span>
      <Tip content={tip} className="tabular col-start-3 whitespace-nowrap text-right font-semibold">
        {value}
        {note && (
          <span className="block font-normal text-[11px] text-muted leading-tight">{note}</span>
        )}
      </Tip>
    </div>
  )
}

/** The short materials' icons, each naming itself and what is short on hover. */
function Icons({ totals }: { totals: readonly MaterialTotal[] }) {
  if (totals.length === 0) return null
  const rest = totals.length - MAX_ICONS
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      {totals.slice(0, MAX_ICONS).map(total => (
        <ShortIcon key={total.key} total={total} />
      ))}
      {rest > 0 && (
        <span className="tabular text-[12px] text-muted">{r.more(formatNumber(rest))}</span>
      )}
    </span>
  )
}

function ShortIcon({ total }: { total: MaterialTotal }) {
  const view = lineView(total.key)
  return (
    <Tip content={`${view.name} ${cellLabel(total.key, total.have, total.need)}`} className="flex">
      <MaterialIcon view={view} className="size-7 rounded-[7px] text-[11px]" />
    </Tip>
  )
}
