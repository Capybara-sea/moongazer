// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useState } from "react"
import { Panel } from "@/components/Panel"
import { Switch } from "@/components/Switch"
import { isUnknown, SLOTS, unknownSlot } from "@/domain/customCharacter"
import { WEAPON_SLOTS } from "@/domain/customWeapon"
import { type Card, goalName } from "@/domain/plan"
import { isExp, openGroup, openOn, tierOf } from "@/domain/planner"
import { cn } from "@/lib/cn"
import { text } from "@/text/zh"
import { lineView, MaterialIcon } from "./MaterialCell"

const t = text.planner

type Total = { key: string; need: number; have: number; goals: string[] }

/** Each material over every card: what they need, what they get, and who needs it. */
function totals(cards: readonly Card[]): Total[] {
  const byKey = new Map<string, Total>()
  for (const card of cards) {
    for (const line of card.lines) {
      const total = byKey.get(line.key) ?? { key: line.key, need: 0, have: 0, goals: [] }
      total.need += line.need
      total.have += line.have
      if (line.have < line.need) total.goals.push(goalName(card.goal))
      byKey.set(line.key, total)
    }
  }
  return [...byKey.values()]
}

/** Today's weekday, and the domain materials still short that drop today. */
export function TodayPanel({ cards, weekday }: { cards: readonly Card[]; weekday: number }) {
  const open = totals(cards).filter(total => {
    const group = openGroup(total.key)
    return group !== undefined && total.have < total.need && openOn(group, weekday)
  })
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
        <ul className="flex flex-col gap-2">
          {open
            .toSorted((a, b) => tierOf(b.key) - tierOf(a.key))
            .map(total => {
              const view = lineView(total.key)
              return (
                <li key={total.key} className="flex items-center gap-2.5">
                  <MaterialIcon view={view} className="size-8 rounded-[8px] text-[13px]" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px]">{view.name}</span>
                    <span className="truncate text-[11px] text-muted">
                      {t.todayShort(view.count(total.need - total.have, true))} ·{" "}
                      {total.goals.join(t.listSeparator)}
                    </span>
                  </span>
                </li>
              )
            })}
        </ul>
      )}
      <p className="text-[11px] text-muted">{t.abundance}</p>
    </Panel>
  )
}

/** A custom character's or weapon's materials not known yet go last, by slot and tier. */
function summaryGroup(key: string): { name: string; order: number } {
  if (isUnknown(key)) return { name: t.summaryUnknown, order: 1e4 }
  if (key === "Mora" || isExp(key)) return { name: t.moraExp, order: -1 }
  const view = lineView(key)
  return { name: view.type ?? "", order: view.typeOrder ?? 999 }
}

function summaryTier(key: string) {
  const unknown = unknownSlot(key)
  if (!unknown) return tierOf(key)
  const slot =
    unknown.of === "weapon"
      ? SLOTS.length + WEAPON_SLOTS.indexOf(unknown.slot)
      : SLOTS.indexOf(unknown.slot)
  return slot * 10 + unknown.tier
}

/**
 * Every card's materials added up by the game's material type; by default
 * only what is short. Those not known yet are listed with what is needed.
 */
export function SummaryPanel({ cards }: { cards: readonly Card[] }) {
  const [onlyShort, setOnlyShort] = useState(true)
  const shown = totals(cards).filter(
    total => !onlyShort || isUnknown(total.key) || total.have < total.need,
  )
  const groups = new Map<string, { order: number; items: Total[] }>()
  for (const total of shown) {
    const { name, order } = summaryGroup(total.key)
    const group = groups.get(name) ?? { order, items: [] }
    group.items.push(total)
    groups.set(name, group)
  }
  return (
    <Panel>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-semibold text-[15px]">{t.summary}</h2>
        <span className="text-[12px] text-muted">{t.onlyShort}</span>
        <Switch checked={onlyShort} label={t.onlyShort} onChange={setOnlyShort} />
      </div>
      {shown.length === 0 && <p className="text-[12px] text-muted">{t.summaryEmpty}</p>}
      {[...groups]
        .toSorted(([, a], [, b]) => a.order - b.order)
        .map(([name, group]) => (
          <section key={name} className="flex flex-col gap-1.5">
            <h3 className="text-[12px] text-muted">{name}</h3>
            <ul className="flex flex-wrap gap-2">
              {group.items
                .toSorted((a, b) => summaryTier(a.key) - summaryTier(b.key))
                .map(total => {
                  const view = lineView(total.key)
                  const short = !view.unknown && total.have < total.need
                  const count = view.count(short ? total.need - total.have : total.need, true)
                  // Cells are all as wide; a count too long is cut short, whole in the tooltip.
                  const amount = `${view.approximate ? t.about : ""}${count}`
                  return (
                    <li
                      key={total.key}
                      title={[`${view.name} ${amount}`, view.approximate ? t.approximate : ""]
                        .filter(Boolean)
                        .join("\n")}
                      className="flex w-[46px] flex-col items-center gap-0.5"
                    >
                      <MaterialIcon view={view} className="size-9 rounded-[9px] text-[14px]" />
                      <span
                        className={cn(
                          "tabular max-w-full truncate text-[11px]",
                          short ? "text-danger" : "text-muted",
                        )}
                      >
                        {amount}
                      </span>
                    </li>
                  )
                })}
            </ul>
          </section>
        ))}
    </Panel>
  )
}
