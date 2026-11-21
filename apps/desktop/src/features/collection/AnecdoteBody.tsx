// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { toast } from "@heroui/react"
import { Check } from "lucide-react"
import { useMemo, useState } from "react"
import { DoneBadge } from "@/components/DoneBadge"
import { EmptyState } from "@/components/EmptyState"
import { GameIcon } from "@/components/GameIcon"
import {
  ANECDOTE_AREAS,
  ANECDOTE_RULES,
  type AnecdoteRow,
  type AnecdoteView,
  anecdoteName,
  byCharacter,
  type CharacterGroup,
  characterName,
  type Need,
  visibleRows,
} from "@/domain/anecdotes"
import { lookup } from "@/domain/names"
import { openTravelersTales, toBackendError } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { useAnecdoteListStore } from "@/stores/anecdoteListStore"
import { text } from "@/text/zh"

const t = text.anecdotePage
const AREA_NAMES = new Map(ANECDOTE_AREAS.map(a => [a.id, a.name]))

/** The characters' grid on the left, the anecdotes by character on the right. */
export function AnecdoteBody({ view }: { view: AnecdoteView }) {
  const onlyTodo = useAnecdoteListStore(s => s.onlyTodo)
  const onlyHidden = useAnecdoteListStore(s => s.onlyHidden)
  const area = useAnecdoteListStore(s => s.area)
  const character = useAnecdoteListStore(s => s.character)
  const query = useAnecdoteListStore(s => s.query)
  const groups = useMemo(() => byCharacter(view.rows), [view])
  const sections = useMemo(() => {
    const rows = visibleRows(view.rows, { onlyTodo, onlyHidden, area, character, query })
    const shown = new Map(byCharacter(rows).map(g => [g.character, g.rows]))
    return groups.flatMap(group => {
      const visible = shown.get(group.character)
      // The character picked shows even with nothing left, to say so.
      if (!visible && group.character !== character) return []
      return [{ group, rows: visible ?? [] }]
    })
  }, [view, groups, onlyTodo, onlyHidden, area, character, query])
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Characters groups={groups} />
      <section aria-label={t.entries} className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
        {sections.length === 0 ? (
          <EmptyState>{onlyTodo && !query ? t.none : t.noMatch}</EmptyState>
        ) : (
          sections.map(s => (
            <Section
              key={s.group.character}
              group={s.group}
              rows={s.rows}
              large={character !== null}
            />
          ))
        )}
        <Source />
      </section>
    </div>
  )
}

function Avatar({ character, className }: { character: string; className: string }) {
  const name = characterName(character)
  const icon = /^[A-Za-z]/.test(character) ? lookup("characters", character).icon : undefined
  return (
    <GameIcon
      icon={icon}
      label={name}
      className={cn("rounded-[10px] border border-border bg-surface-secondary", className)}
    />
  )
}

/** Every character, or only those with anecdotes left when only those are shown. */
function Characters({ groups }: { groups: CharacterGroup[] }) {
  const onlyTodo = useAnecdoteListStore(s => s.onlyTodo)
  const character = useAnecdoteListStore(s => s.character)
  const { setCharacter } = useAnecdoteListStore.getState()
  const shown = onlyTodo ? groups.filter(g => g.todo > 0) : groups
  const left = groups.reduce((sum, g) => sum + g.todo, 0)
  return (
    <aside
      aria-label={t.characters}
      className="glass flex max-w-[288px] flex-[1_1_260px] flex-col gap-2 rounded-[14px] border border-border bg-surface p-2.5"
    >
      <button
        type="button"
        aria-pressed={character === null}
        onClick={() => setCharacter(null)}
        className={cn(
          "h-9 cursor-pointer rounded-[8px] font-semibold text-[13px] transition-colors duration-150 motion-reduce:transition-none",
          character === null ? "bg-(--accent-soft)" : "hover:bg-default/60",
        )}
      >
        {t.allCharacters(left)}
      </button>
      <div className="grid grid-cols-4 gap-1.5">
        {shown.map(g => {
          const on = character === g.character
          const total = g.rows.filter(r => r.status !== "absent").length
          const name = characterName(g.character)
          return (
            <button
              key={g.character}
              type="button"
              aria-pressed={on}
              title={name}
              onClick={() => setCharacter(on ? null : g.character)}
              className={cn(
                "relative flex cursor-pointer flex-col items-center gap-0.5 rounded-[10px] border px-0.5 py-1.5 transition-colors duration-150 motion-reduce:transition-none",
                on ? "border-accent bg-(--accent-soft)" : "border-transparent hover:bg-default/60",
              )}
            >
              <span className="relative">
                <Avatar character={g.character} className="size-10 text-[14px]" />
                {g.todo === 0 && <DoneBadge label={t.allDone} />}
              </span>
              <span className="max-w-full truncate text-[11px]">{name}</span>
              <span className="text-[10px] text-muted tabular">
                {g.done} / {total}
              </span>
            </button>
          )
        })}
      </div>
      <span className="text-[12px] text-muted">
        {onlyTodo
          ? t.gridNote(groups.length - shown.length, groups.length)
          : t.gridAll(groups.length)}
      </span>
    </aside>
  )
}

type SectionProps = { group: CharacterGroup; rows: AnecdoteRow[]; large: boolean }

function Section({ group, rows, large }: SectionProps) {
  const counted = group.rows.filter(r => r.status !== "absent")
  const areas = t.areaList(
    [...new Set(group.rows.map(r => r.info.area))].map(id => AREA_NAMES.get(id) ?? String(id)),
  )
  return (
    <div className="glass flex flex-col rounded-[14px] border border-border bg-surface">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <Avatar
          character={group.character}
          className={large ? "size-14 text-[18px]" : "size-8 text-[15px]"}
        />
        <span className="flex flex-col">
          <span className={cn("font-semibold", large ? "text-[18px]" : "text-[15px]")}>
            {characterName(group.character)}
          </span>
          <span className="text-[12px] text-muted tabular">
            {t.sectionInfo(counted.length, group.done, areas)}
          </span>
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="border-(--separator) border-t px-3.5 py-3 text-[13px] text-muted">{t.none}</p>
      ) : (
        rows.map(row => <Item key={row.info.id} row={row} />)
      )}
    </div>
  )
}

const RING = {
  recorded: "border-(--ok) border-solid bg-(--ok) text-(--on-accent)",
  waiting: "border-(--gold-fg) border-solid bg-(--gold-bg)",
  unmet: "border-muted border-dashed",
  absent: "border-muted border-dashed",
} as const

/** A thing to do first, with whether it is done; unknown where the export does not say. */
function needLine(need: Need) {
  const what =
    need.kind === "anecdote"
      ? t.needAnecdote(anecdoteName(need.id))
      : need.kind === "quest"
        ? need.name
        : t.needCharacter(characterName(need.key))
  if (need.met === undefined) return { text: t.needUnknown(what), warn: false }
  if (need.met) return { text: t.needMet(what), warn: false, done: true }
  return { text: need.kind === "character" ? t.needMissing(what) : t.needOpen(what), warn: true }
}

function Item({ row }: { row: AnecdoteRow }) {
  const [peek, setPeek] = useState(false)
  const { info, status } = row
  const absent = status === "absent"
  // Our own tips, in a box under the game's text: the place while there is anything left to do
  // there; what brings it on and what comes first only before it has come at all.
  const left = !absent && (!row.recorded || row.left > 0)
  const unmet = status === "unmet"
  const line = absent
    ? t.absent
    : row.recorded || peek
      ? info.summary
      : info.hidden
        ? t.hiddenLine
        : (info.hint ?? "")
  const tips: { text: string; warn: boolean; done?: boolean }[] = [
    ...(unmet && info.trigger ? [{ text: t.trigger(info.trigger), warn: false }] : []),
    ...(left && info.place ? [{ text: t.place(info.place), warn: false }] : []),
    ...(left && info.time ? [{ text: t.time[info.time] ?? "", warn: false }] : []),
    ...(left && info.after !== undefined
      ? [{ text: t.after(anecdoteName(info.after)), warn: false }]
      : []),
    ...(unmet ? row.needs.map(needLine) : []),
    ...(unmet && info.tip ? [{ text: info.tip, warn: false }] : []),
    ...(unmet && info.unsure ? [{ text: t.unsure(info.unsure), warn: true }] : []),
  ].filter(tip => tip.text)
  return (
    <div
      className={cn(
        "grid grid-cols-[22px_minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 border-(--separator) border-t px-3.5 py-3",
        absent && "opacity-50",
      )}
    >
      <span
        role="img"
        aria-label={t.status[status]}
        className={cn(
          "mt-0.5 flex size-[18px] items-center justify-center rounded-full border-2",
          RING[status],
        )}
      >
        {status === "recorded" && <Check size={11} strokeWidth={3.5} aria-hidden />}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <b className="text-sm">{info.title}</b>
        <Tags row={row} />
      </span>
      <span />
      <span />
      <span className={cn("text-[13px]", row.recorded || peek || absent ? "text-muted" : "")}>
        {line}
      </span>
      {!row.recorded && !absent ? (
        <button
          type="button"
          onClick={() => setPeek(!peek)}
          className="cursor-pointer self-start whitespace-nowrap text-(--accent-text) text-[12px] hover:underline"
        >
          {peek ? t.unpeek : t.peek}
        </button>
      ) : (
        <span />
      )}
      {tips.length > 0 && (
        <ul
          aria-label={t.tips}
          className="col-span-2 col-start-2 mt-1 flex flex-col gap-0.5 rounded-[8px] border border-border bg-surface-secondary px-2.5 py-1.5 text-[12px]"
        >
          {tips.map(tip => (
            <li key={tip.text} className={tip.warn ? "text-(--warn)" : "text-muted"}>
              {tip.text}
              {tip.done && (
                <>
                  {" "}
                  <DoneBadge inline label={t.needDone} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Where the guide's places and triggers come from, with a link to it. */
function Source() {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
      {t.source}
      <button
        type="button"
        aria-label={t.openSourceLabel}
        title={t.openSourceLabel}
        onClick={() => {
          openTravelersTales().catch((error: unknown) => {
            toast(t.openFailed, { description: toBackendError(error).message })
          })
        }}
        className="cursor-pointer text-(--accent-text) hover:underline"
      >
        {t.openSource}
      </button>
    </p>
  )
}

const TAG = "rounded-full border px-[7px] text-[11px] leading-[18px]"

function Tags({ row }: { row: AnecdoteRow }) {
  const { daily, lauma } = ANECDOTE_RULES
  const { info } = row
  const isDaily = info.id === daily.id
  return (
    <>
      <span className={cn(TAG, "border-border text-muted")}>
        {AREA_NAMES.get(info.area) ?? info.area}
      </span>
      {info.hidden && (
        <span className={cn(TAG, "border-(--purple-fg) text-(--purple-fg)")}>{t.hidden}</span>
      )}
      {(isDaily || row.seals !== undefined) && (
        <span className={cn(TAG, "border-transparent bg-(--gold-bg) text-(--gold-fg) tabular")}>
          {isDaily ? t.daily : t.sealsTag(row.seals ?? 0)}
        </span>
      )}
      {isDaily && (row.days ?? 0) > 0 && (
        <span className={cn(TAG, "border-transparent bg-(--accent-soft) text-(--accent-text)")}>
          {t.dailyDone(row.days ?? 0)}
        </span>
      )}
      {info.id === daily.last && (
        <span className={cn(TAG, "border-border text-muted")}>
          {t.pairTotal(anecdoteName(daily.id), daily.total)}
        </span>
      )}
      {info.id === lauma.choice && row.days !== undefined && (
        <span className={cn(TAG, "border-transparent bg-(--accent-soft) text-(--accent-text)")}>
          {t.repeatDays(lauma.days, row.days)}
        </span>
      )}
      {row.status === "absent" && (
        <span className={cn(TAG, "border-transparent bg-(--warn)/15 text-(--warn)")}>
          {t.needsLauma}
        </span>
      )}
    </>
  )
}
