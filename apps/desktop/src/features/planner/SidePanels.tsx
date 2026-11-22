// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { GripVertical } from "lucide-react"
import { useState } from "react"
import { CheckboxField } from "@/components/CheckboxField"
import { Panel } from "@/components/Panel"
import { Tip, useTip } from "@/components/Tip"
import { isUnknown, SLOTS, unknownSlot } from "@/domain/customCharacter"
import { WEAPON_SLOTS } from "@/domain/customWeapon"
import {
  knownLike,
  type MaterialTotal,
  MORA_EXP_GROUP,
  orderGroups,
  SPECIALTY_GROUP,
  summaryGroup,
  WEEKLY_BOSS_GROUP,
  WORLD_BOSS_GROUP,
} from "@/domain/plan"
import { moveSummaryGroup } from "@/domain/planEdits"
import { tierOf } from "@/domain/planner"
import { farmToday } from "@/domain/today"
import { cn } from "@/lib/cn"
import { useDragOrder } from "@/lib/useDragOrder"
import { usePlannerStore } from "@/stores/plannerStore"
import { text } from "@/text/zh"
import {
  amountLines,
  lineView,
  MaterialIcon,
  materialTip,
  shortOf,
  useBagHolds,
} from "./MaterialCell"

const t = text.planner
/**
 * Material cells: five to a row, spread over the column so the rows line up
 * across groups; wrapped as they come when the panels sit under the cards.
 */
const CELLS =
  "flex flex-wrap gap-2 lg:grid lg:grid-cols-[repeat(5,48px)] lg:justify-between lg:gap-x-0"

type Totals = ReadonlyMap<string, MaterialTotal>

/** Where a material's group goes by default: Mora and EXP first, then by the game's type. */
function groupRank(key: string) {
  const id = summaryGroup(key)
  if (id === MORA_EXP_GROUP) return -1
  // Weekly bosses' drops right after the world bosses', whose type they share.
  return (lineView(knownLike(key)).typeOrder ?? 999) + (id === WEEKLY_BOSS_GROUP ? 0.5 : 0)
}

const GROUP_NAMES: Record<string, string> = {
  [MORA_EXP_GROUP]: t.moraExp,
  [SPECIALTY_GROUP]: t.specialties,
  [WORLD_BOSS_GROUP]: t.worldBoss,
  [WEEKLY_BOSS_GROUP]: t.weeklyBoss,
}

function groupName(id: string) {
  return GROUP_NAMES[id] ?? id
}

/**
 * Within a group: by tier, specialties by region, and materials not known
 * yet after the known ones, by their slot.
 */
function summaryTier(key: string) {
  const unknown = unknownSlot(key)
  if (!unknown) return tierOf(key) + (lineView(key).typeOrder ?? 0) * 10
  const slot =
    unknown.of === "weapon"
      ? SLOTS.length + WEAPON_SLOTS.indexOf(unknown.slot)
      : SLOTS.indexOf(unknown.slot)
  return 1e5 + slot * 10 + unknown.tier
}

/**
 * A material over every card: its icon over what is still short, red, or
 * that it is enough; muted, with what is needed, when not known yet. Cells are all as
 * wide, so a long count is cut short; the tip, the same all over the cell,
 * has "have/need" and what the bag holds.
 */
export function TotalCell({ total }: { total: MaterialTotal }) {
  const view = lineView(total.key)
  const bag = useBagHolds(total.key)
  const short = !view.unknown && total.have < total.need
  const tip = useTip<HTMLLIElement>(
    materialTip(view.name, amountLines(total.key, total.have, total.need, bag), total.goals),
  )
  return (
    <li {...tip.props} className="flex w-[48px] flex-col items-center gap-0.5">
      <MaterialIcon view={view} className="size-11 rounded-[10px] text-[16px]" />
      <span
        className={cn(
          "tabular max-w-full truncate text-[11px]",
          short ? "text-danger" : "text-muted",
        )}
      >
        {shortOf(total.key, total.have, total.need)}
      </span>
      {tip.bubble}
    </li>
  )
}

/** Today's weekday, and the domain materials still short that drop today. */
export function TodayPanel({ totals, weekday }: { totals: Totals; weekday: number }) {
  const open = farmToday(totals, weekday)
  return (
    <Panel>
      <h2 className="font-semibold text-[15px]">{t.today(weekday)}</h2>
      <ol aria-hidden className="grid grid-cols-7 gap-1">
        {t.weekdays.map((day, i) => (
          <li
            key={day}
            className={cn(
              "rounded-[6px] py-0.5 text-center text-[12px]",
              i === weekday ? "bg-accent text-accent-foreground" : "bg-default/40 text-muted",
            )}
          >
            {day}
          </li>
        ))}
      </ol>
      <p className="text-[12px] text-muted">
        {weekday === 6 ? t.sunday : open.length > 0 ? t.todayHint : t.todayNone}
      </p>
      {open.length > 0 && (
        <ul className={CELLS}>
          {open.map(total => (
            <TotalCell key={total.key} total={total} />
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted">{t.abundance}</p>
    </Panel>
  )
}

type SummaryProps = {
  totals: Totals
  /** The groups the player has moved, in their order. */
  order?: readonly string[]
}

/**
 * Every card's materials added up by the game's material type; by default
 * only what is short. Those not known yet are listed with what is needed.
 * The groups are dragged into the order the player likes, or moved with the
 * arrow keys on their grips.
 */
export function SummaryPanel({ totals, order }: SummaryProps) {
  const [onlyShort, setOnlyShort] = useState(true)
  const groups = new Map<string, { rank: number; items: MaterialTotal[] }>()
  for (const total of totals.values()) {
    if (onlyShort && !isUnknown(total.key) && total.have >= total.need) continue
    const id = summaryGroup(total.key)
    const group = groups.get(id) ?? { rank: groupRank(total.key), items: [] }
    // The specialties' group goes where its first region's type would.
    group.rank = Math.min(group.rank, groupRank(total.key))
    group.items.push(total)
    groups.set(id, group)
  }
  const byDefault = [...groups].toSorted(([, a], [, b]) => a.rank - b.rank).map(([id]) => id)
  const ids = orderGroups(byDefault, order)
  const drag = useDragOrder((from, to) =>
    usePlannerStore.getState().change(plan => moveSummaryGroup(plan, ids, from, to)),
  )
  return (
    <Panel>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-semibold text-[15px]">{t.summary}</h2>
        <CheckboxField checked={onlyShort} label={t.onlyShort} onChange={setOnlyShort} />
      </div>
      {ids.length === 0 && <p className="text-[12px] text-muted">{t.summaryEmpty}</p>}
      {ids.map((id, index) => {
        const name = groupName(id)
        return (
          <section
            key={id}
            {...(ids.length > 1 ? drag.item(index) : {})}
            className="-mx-2 -my-1 flex flex-col gap-1.5 rounded-[12px] px-2 py-1 transition-[background-color] duration-200 ease-(--ease-out-soft) data-dragging:bg-overlay motion-reduce:transition-none"
          >
            <h3 className="flex items-center gap-0.5 text-[12px] text-muted">
              {ids.length > 1 && (
                <Tip content={t.dragHint} className="contents">
                  <button
                    type="button"
                    {...drag.handle(index)}
                    aria-label={t.dragLabel(name)}
                    className="-ml-1 flex h-5 w-4 flex-none cursor-grab items-center justify-center rounded-[5px] transition-colors duration-150 hover:bg-default/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 motion-reduce:transition-none"
                  >
                    <GripVertical aria-hidden size={13} />
                  </button>
                </Tip>
              )}
              {name}
            </h3>
            <ul className={CELLS}>
              {(groups.get(id)?.items ?? [])
                .toSorted((a, b) => summaryTier(a.key) - summaryTier(b.key))
                .map(total => (
                  <TotalCell key={total.key} total={total} />
                ))}
            </ul>
          </section>
        )
      })}
    </Panel>
  )
}
