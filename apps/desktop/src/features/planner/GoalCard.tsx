// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Check } from "lucide-react"
import { GameIcon } from "@/components/GameIcon"
import { RARITY_TONES } from "@/components/RarityChip"
import { familyOptions, isUnknown, unknownSlot } from "@/domain/customCharacter"
import { weaponFamilyOptions } from "@/domain/customWeapon"
import { characterData, materialData, weaponData } from "@/domain/names"
import {
  type Card,
  type CharacterGoal,
  type CustomGoal,
  isWeaponGoal,
  talentOrder,
} from "@/domain/plan"
import {
  compareStages,
  isExp,
  type Line,
  openGroup,
  openOn,
  type Stage,
  TALENTS,
  tierOf,
  waitsToLevel,
} from "@/domain/planner"
import { cn } from "@/lib/cn"
import { text } from "@/text/zh"
import { type CardDrag, dimmed, GoalHeader } from "./GoalHeader"
import { MaterialCell } from "./MaterialCell"

const t = text.planner

/** "80★" for ascended and not levelled past the old cap, as on the characters page. */
export function stageLabel(stage: Stage, caps: readonly number[]) {
  return `${stage.level}${waitsToLevel(stage, caps) ? "★" : ""}`
}

/** The key a material sorts by: one not known yet sorts as its slot's released ones do. */
function sortKey(key: string) {
  const unknown = unknownSlot(key)
  if (!unknown) return key
  const families =
    unknown.of === "weapon" ? weaponFamilyOptions(unknown.slot) : familyOptions(unknown.slot)
  return families[0]?.[unknown.tier] ?? key
}

/** By the game's material types, lower tiers first; Mora and EXP last. */
function byKind(a: Line, b: Line) {
  const [keyA, keyB] = [sortKey(a.key), sortKey(b.key)]
  const rank = (key: string) =>
    key === "Mora" ? 1e4 : isExp(key) ? 1e4 + 1 : (materialData(key).typeOrder ?? 999)
  return rank(keyA) - rank(keyB) || tierOf(keyA) - tierOf(keyB) || keyA.localeCompare(keyB)
}

type Props = {
  card: Card
  weekday: number
  drag?: CardDrag
  onEdit: () => void
  onReplace: () => void
}

/**
 * A goal: what it is, where it stands against the goal, and what it takes
 * from the bag; switched off, it fades and takes nothing. It is dragged by
 * any part but its controls; the row of goals, which opens the editor on a
 * click, counts as a part.
 */
export function GoalCard({ card, weekday, drag, onEdit, onReplace }: Props) {
  const { goal, from, caps, lines, stageKeys, off } = card
  const toStage = isWeaponGoal(goal) ? goal.to : goal.to.stage
  // The passive halves ascensions only, so it says nothing while none are left.
  const halvedBy =
    card.moraDiscount && toStage.phase > from.stage.phase
      ? t.moraHalved(characterData(card.moraDiscount).name)
      : undefined
  const sorted = lines.toSorted(byKind)
  const rest = sorted.filter(l => l.key !== "Mora" && !isExp(l.key))
  const ascension = rest.filter(l => stageKeys.has(l.key))
  const talents = rest.filter(l => !stageKeys.has(l.key))
  const tail = sorted.filter(l => l.key === "Mora" || isExp(l.key))
  const rows: [string, Line[]][] = [
    [t.rows.ascension, ascension],
    [t.rows.talents, talents],
  ]
  const last = rows.findLast(([, list]) => list.length > 0) ?? rows[0]
  if (last) last[1] = [...last[1], ...tail]
  return (
    <article
      {...drag?.item}
      className="glass flex flex-col gap-3 rounded-[16px] border border-border bg-surface px-4.5 py-4"
    >
      <GoalHeader card={card} drag={drag} onReplace={onReplace} />
      <div className={cn("flex items-center gap-3", dimmed(off))}>
        <Avatar card={card} />
        <button
          type="button"
          data-drag-handle
          onClick={onEdit}
          className="flex min-w-0 flex-1 cursor-pointer items-stretch gap-3 rounded-[10px] px-1 py-0.5 text-left transition-colors duration-150 hover:bg-default/40 motion-reduce:transition-none"
        >
          <Target
            label={t.level}
            title={t.stageTitle(
              `${from.stage.level}/${caps[from.stage.phase] ?? ""}`,
              `${toStage.level}/${caps[toStage.phase] ?? ""}`,
              Math.max(0, toStage.phase - from.stage.phase),
            )}
            from={stageLabel(from.stage, caps)}
            to={stageLabel(toStage, caps)}
            state={targetState(compareStages(from.stage, toStage))}
          />
          {isWeaponGoal(goal) && goal.expBoost && (
            <span
              data-rise
              title={t.expBoostTip}
              className="flex-none self-center rounded-[6px] bg-default/60 px-1.5 text-[11px] text-muted leading-[18px]"
            >
              {t.expBoostTag}
            </span>
          )}
          {!isWeaponGoal(goal) && (
            <>
              <span aria-hidden className="w-px self-stretch bg-border" />
              {TALENTS.map(talent => {
                const order = rankedOrder(goal)
                const now = from.talents[talent]
                const aim = goal.to.talents[talent]
                return (
                  <Target
                    key={talent}
                    label={`${t.rank[order.indexOf(talent)] ?? ""}${t.talents[talent]}`}
                    title={t.talentTitle(t.talents[talent], now, aim)}
                    from={String(now)}
                    to={String(aim)}
                    state={aim === 0 ? "off" : targetState(now - aim)}
                  />
                )
              })}
            </>
          )}
        </button>
      </div>
      {rows.map(([label, list]) =>
        list.length === 0 ? null : (
          <div key={label} data-rise className="flex items-start gap-2">
            <span className="w-8 flex-none pt-3 text-[12px] text-muted">{label}</span>
            <ul className="flex flex-wrap gap-x-1.5 gap-y-2">
              {list.map(line => (
                <MaterialCell
                  key={line.key}
                  line={line}
                  note={line.key === "Mora" ? halvedBy : undefined}
                />
              ))}
            </ul>
          </div>
        ),
      )}
      <Footer card={card} weekday={weekday} />
    </article>
  )
}

type TargetState = "done" | "todo" | "off"

function targetState(compared: number): TargetState {
  return compared >= 0 ? "done" : "todo"
}

type TargetProps = { label: string; title: string; from: string; to: string; state: TargetState }

/** One goal: "now → goal", the goal alone with a tick when reached. */
function Target({ label, title, from, to, state }: TargetProps) {
  return (
    <span title={title} className="flex min-w-0 flex-col gap-0.5">
      <span className="whitespace-nowrap text-[11px] text-muted">{label}</span>
      <span className="tabular whitespace-nowrap text-[17px] leading-tight">
        {state === "done" ? (
          <span className="inline-flex items-center gap-0.5 font-semibold text-success">
            {to}
            <Check aria-hidden size={14} />
          </span>
        ) : state === "off" ? (
          <span className="text-muted">{from}</span>
        ) : (
          <>
            <span className="text-muted">{from}</span>
            <span className="px-1 text-[13px] text-muted">→</span>
            <span className="font-semibold">{to}</span>
          </>
        )}
      </span>
    </span>
  )
}

/** The talent order the rank marks follow; none for a custom character till the player sets one. */
export function rankedOrder(goal: CharacterGoal | CustomGoal) {
  return goal.kind === "custom" && !goal.order ? [] : talentOrder(goal)
}

function Avatar({ card }: { card: Card }) {
  const { goal } = card
  const data =
    goal.kind === "custom" || goal.kind === "customWeapon"
      ? { icon: undefined, name: goal.name, rarity: goal.rarity }
      : goal.kind === "weapon"
        ? weaponData(goal.key)
        : characterData(goal.key)
  return (
    <GameIcon
      icon={data.icon}
      label={data.name}
      placeholder={goal.kind === "custom" || goal.kind === "customWeapon" ? "?" : undefined}
      className={cn(
        "size-14 rounded-[14px] text-[20px]",
        RARITY_TONES[data.rarity ?? 0] ?? "bg-surface-secondary",
      )}
    />
  )
}

/** The footer's status; none while only materials not known yet are left to tell. */
export function cardStatus(card: Card): { label: string; tone: string } | undefined {
  const unknown = card.lines.some(line => isUnknown(line.key))
  const short = card.lines.filter(line => !isUnknown(line.key) && line.have < line.need).length
  const [step] = card.steps
  if (card.off) return { label: t.status.off, tone: "text-muted" }
  if (card.done) return { label: t.status.done, tone: "text-success" }
  if (short === 0 && !unknown) return { label: t.status.complete, tone: "text-success" }
  if (step) return { label: t.status[step.kind], tone: "text-(--accent-text)" }
  if (short > 0) return { label: t.status.short(short), tone: "text-danger" }
  return undefined
}

function Footer({ card, weekday }: { card: Card; weekday: number }) {
  const groups = new Set(
    card.lines.flatMap(line => {
      const group = openGroup(line.key)
      return group === undefined || line.have >= line.need ? [] : [group]
    }),
  )
  const what = isWeaponGoal(card.goal) ? t.weaponMaterials : t.books
  const today = [...groups].some(group => openOn(group, weekday))
  const days =
    groups.size === 0
      ? undefined
      : today
        ? t.openToday(what)
        : [...groups].map(group => t.openOn(what, group)).join(" · ")
  const unknown = card.lines.filter(line => isUnknown(line.key))
  // The domain materials decide the days; a custom weapon's are its slot "weapon".
  const daysUnknown = unknown.some(line => {
    const slot = unknownSlot(line.key)
    return slot?.of === "weapon" ? slot.slot === "weapon" : slot?.slot === "book"
  })
  const status = cardStatus(card)
  return (
    <div className="flex items-center gap-2 border-border border-t pt-2.5 text-[12px]">
      {daysUnknown ? (
        <span className="text-muted">{t.daysUnknown(what)}</span>
      ) : (
        days && (
          <span title={t.abundance} className={today ? "text-(--accent-text)" : "text-muted"}>
            {days}
          </span>
        )
      )}
      <span className="flex-1" />
      {unknown.length > 0 && <span className="text-muted">{t.unknownKinds(unknown.length)}</span>}
      {status && <span className={cn("font-semibold", status.tone)}>{status.label}</span>}
    </div>
  )
}
