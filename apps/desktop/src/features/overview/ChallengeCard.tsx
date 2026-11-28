// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Moon, Star } from "lucide-react"
import type { ReactNode } from "react"
import { Bar } from "@/components/Bar"
import { CardHeader } from "@/components/CardHeader"
import { DoneBadge } from "@/components/DoneBadge"
import { GameIcon } from "@/components/GameIcon"
import { HoverPreview } from "@/components/HoverPreview"
import { Panel } from "@/components/Panel"
import { Tip } from "@/components/Tip"
import type { Account } from "@/domain/account"
import { ELEMENT_ICONS } from "@/domain/elements"
import { serverMonthDay } from "@/domain/gameTime"
import { lookup } from "@/domain/names"
import {
  type AbyssBlessing,
  abyssBlessing,
  abyssStart,
  STYGIAN_SEASONS,
  type TheaterCast,
  theaterCast,
  theaterEnd,
  theaterLevelName,
} from "@/domain/overviewData"
import { cn } from "@/lib/cn"
import { formatMonthDay, formatTime } from "@/lib/format"
import { useNow } from "@/lib/useNow"
import { lang, text } from "@/text"
import {
  type ActState,
  allStars,
  currentAbyssPeriod,
  currentStygian,
  fightTime,
  stygianFullClear,
  stygianSummary,
  theaterActs,
  timeLeft,
} from "./challenges"

const t = text.challenges

const PIPS: Record<ActState, string> = {
  starred: "border-transparent bg-(--accent-soft) text-(--gold-fg)",
  passed: "border-transparent bg-(--accent-soft) text-muted",
  ahead: "border-(--field-border)",
}

/** One fact of a record, as the game writes it: "best record  Lunar Mode act 10". */
type Fact = { label?: string; value: string; star?: boolean; tip?: string }

type Challenge = {
  name: string
  /** Time left; none when the export has nothing on this challenge. */
  left?: string
  /** The period, for the bar of time left; the start is unknown for some. */
  start?: number
  end?: number
  facts: Fact[]
  /** The period is done: every star, or Stygian's full clear. */
  done?: boolean
  acts?: ActState[]
  blessing?: AbyssBlessing
  cast?: TheaterCast
  /** Character keys, one list per team. */
  teams: string[][]
}

/**
 * The Spiral Abyss, Imaginarium Theater and Stygian Onslaught periods running
 * when the snapshot was taken, with the time left until they end.
 */
export function ChallengeCard({ account, takenAt }: { account: Account; takenAt: number }) {
  const now = useNow()
  const rows = [abyss(account, now), theater(account, now), stygian(account, takenAt, now)]
  return (
    <Panel aria-label={t.title} className="min-w-0 flex-[1_1_380px] gap-0 px-[18px] pt-3.5 pb-2">
      <CardHeader title={t.title}>
        <span className="tabular text-[12px] text-muted">
          {text.daily.asOf(`${formatMonthDay(takenAt)} ${formatTime(takenAt)}`)}
        </span>
      </CardHeader>
      {rows.map(challenge => (
        <Row key={challenge.name} {...challenge} />
      ))}
    </Panel>
  )
}

function notRead(name: string): Challenge {
  return { name, facts: [{ value: text.snapshot.notRead }], teams: [] }
}

function abyss(account: Account, now: number): Challenge {
  const running = account.tasks?.abyss
  if (!running) return notRead(t.abyss)
  const period = currentAbyssPeriod(account.endgame?.abyss, running.start, abyssStart)
  const facts: Fact[] = [
    {
      label: t.best,
      value: String(running.stars),
      star: true,
      tip: t.stars(running.stars, running.maxStars),
    },
  ]
  if (period) facts.push({ label: t.deepest, value: t.floorChamber(period.floor, period.chamber) })
  return {
    name: t.abyss,
    left: timeLeft(running.end, now),
    start: running.start,
    end: running.end,
    facts,
    done: allStars(running.stars, running.maxStars),
    blessing: abyssBlessing(running.start),
    teams: period?.picked.length ? [period.picked] : [],
  }
}

function theater(account: Account, now: number): Challenge {
  const record = account.endgame?.theater
  if (!record) return notRead(t.theater)
  const end = theaterEnd(record.season)
  // Seasons follow one another, so this one began when the one before it ended.
  const period = { left: timeLeft(end, now), start: theaterEnd(record.season - 1), end }
  const cast = theaterCast(record.season)
  // The export has no theater team.
  if (record.acts === 0) {
    return { name: t.theater, ...period, facts: [{ value: t.notStarted }], cast, teams: [] }
  }
  const level = record.level === undefined ? undefined : theaterLevelName(record.level)
  const act = t.theaterAct(record.acts)
  return {
    name: t.theater,
    ...period,
    facts: [
      {
        label: t.best,
        value: level ? `${level} ${act}` : act,
        tip: t.stars(record.stars, record.maxStars),
      },
    ],
    done: allStars(record.stars, record.maxStars),
    acts: theaterActs(record),
    cast,
    teams: [],
  }
}

function stygian(account: Account, takenAt: number, now: number): Challenge {
  const records = account.endgame?.stygian
  const { end, record } = currentStygian(records, STYGIAN_SEASONS, takenAt)
  const earlier = STYGIAN_SEASONS.map(season => season.end).filter(
    other => end !== undefined && other < end,
  )
  const period = {
    left: timeLeft(end, now),
    start: earlier.length > 0 ? Math.max(...earlier) : undefined,
    end,
  }
  if (!record) {
    const note = !account.endgame
      ? text.snapshot.notRead
      : records
        ? t.notStarted
        : t.stygianMissing
    return { name: t.stygian, ...period, facts: [{ value: note }], teams: [] }
  }
  const { done, total, fastest, totalTime } = stygianSummary(record)
  const facts: Fact[] = [
    {
      label: t.best,
      value: t.stygianDifficulty(record.difficulty),
      tip: t.stygianNote(done, total),
    },
  ]
  if (fastest !== undefined) facts.push({ label: t.fastest, value: t.seconds(fastest) })
  if (totalTime !== undefined) facts.push({ label: t.totalTime, value: fightTime(totalTime) })
  if (done < total) facts.push({ value: t.stygianNote(done, total) })
  return {
    name: t.stygian,
    ...period,
    facts,
    done: stygianFullClear(record),
    teams: record.fights.map(fight => fight.team).filter(team => team.length > 0),
  }
}

/** The name with the time left, then the record, then the blessing, cast or teams. */
function Row({ name, left, start, end, facts, done, acts, blessing, cast, teams }: Challenge) {
  const now = useNow()
  const share =
    start !== undefined && end !== undefined && end > start
      ? Math.min(1, Math.max(0, (end - now) / (end - start)))
      : undefined
  return (
    <div className="flex flex-1 flex-col justify-center gap-2 border-(--separator) border-t py-2.5">
      {/* The names and the times left take one width each, so the three bars line up. */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex-none whitespace-nowrap font-semibold text-[14px]",
            lang === "en" ? "w-40" : "w-24",
          )}
        >
          {name}
        </span>
        {share !== undefined && <Bar value={share} className="min-w-10 flex-1" />}
        {left && (
          <Tip
            content={end === undefined ? undefined : t.endsAt(serverMonthDay(end))}
            className={cn(
              "tabular min-w-[6em] whitespace-nowrap text-right text-[12px] text-muted",
              !share && "ml-auto",
            )}
          >
            {left}
          </Tip>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
        {facts.map(fact => (
          <Tip
            key={fact.label ?? fact.value}
            content={fact.tip}
            className="flex items-center gap-1.5 whitespace-nowrap text-[13px]"
          >
            {fact.label && <span className="text-[12px] text-muted">{fact.label}</span>}
            {fact.star && <AbyssStar />}
            <span className="tabular font-semibold">{fact.value}</span>
          </Tip>
        ))}
        {acts && <Acts acts={acts} />}
        {done && (
          <span className="ml-auto flex items-center gap-1 whitespace-nowrap font-semibold text-(--ok) text-[12px]">
            <DoneBadge inline />
            {t.done}
          </span>
        )}
      </div>
      {(blessing || cast || teams.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {blessing && <Blessing blessing={blessing} />}
          {cast && <Cast cast={cast} />}
          {teams.length > 0 && <Teams teams={teams} />}
        </div>
      )}
    </div>
  )
}

/** The four-pointed star the game marks Abyss stars with. */
function AbyssStar() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-3.5 flex-none text-(--gold-fg)">
      <path
        fill="currentColor"
        d="M12 0Q13.2 10.8 24 12Q13.2 13.2 12 24Q10.8 13.2 0 12Q10.8 10.8 12 0Z"
      />
    </svg>
  )
}

function Acts({ acts }: { acts: ActState[] }) {
  return (
    <span className="flex items-center gap-0.5">
      {acts.map((state, i) => {
        const label = t.actStates[state](i + 1)
        return (
          <Tip
            // biome-ignore lint/suspicious/noArrayIndexKey: an act's place is its identity
            key={i}
            role="img"
            aria-label={label}
            content={label}
            className={cn(
              "flex size-4 items-center justify-center rounded-[4px] border",
              PIPS[state],
            )}
          >
            {state !== "ahead" && (
              <Star
                aria-hidden
                fill="currentColor"
                strokeWidth={0}
                className={cn("size-2.5", state === "passed" && "opacity-35")}
              />
            )}
          </Tip>
        )
      })}
    </span>
  )
}

/** Each team's avatars, with a line between teams. */
function Teams({ teams }: { teams: string[][] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      {teams.map((team, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fight's place is its identity
        <span key={i} className="flex items-center gap-2.5">
          {i > 0 && <span aria-hidden className="h-5 w-px bg-border" />}
          <span className="flex gap-1">
            {team.map(key => (
              <Avatar
                key={key}
                characterKey={key}
                className="size-[26px] border-border bg-surface-secondary text-[11px]"
              />
            ))}
          </span>
        </span>
      ))}
    </div>
  )
}

/** The effect shows on hover only. No icon host has the blessing icons, hence the moon glyph. */
function Blessing({ blessing }: { blessing: AbyssBlessing }) {
  return (
    <HoverPreview
      preview={
        <>
          <span className="font-semibold text-[13px]">{blessing.name}</span>
          <span className="whitespace-pre-line">{blessing.text}</span>
        </>
      }
      previewClassName="w-[320px] gap-1.5"
      className="items-center gap-2"
    >
      <span
        aria-hidden
        className="flex size-[26px] flex-none items-center justify-center rounded-full border border-border bg-surface-secondary text-(--accent-text)"
      >
        <Moon className="size-[13px]" />
      </span>
      <span className="text-[13px]">
        <span className="text-muted">{t.blessing} · </span>
        {blessing.name}
      </span>
    </HoverPreview>
  )
}

function Cast({ cast }: { cast: TheaterCast }) {
  const avatar = "size-[26px] text-[11px]"
  return (
    <>
      <Labeled label={t.elements} className="gap-[5px]">
        {cast.elements.map(element => (
          <GameIcon
            key={element}
            icon={ELEMENT_ICONS[element]}
            label={text.game.elementLong(text.game.elements[element])}
            className="size-5 text-[10px]"
            glyph
          />
        ))}
      </Labeled>
      <Labeled label={t.guests}>
        {cast.guests.map(key => (
          <Avatar
            key={key}
            characterKey={key}
            className={cn(avatar, "border-(--gold-fg) bg-(--gold-bg)")}
          />
        ))}
      </Labeled>
      <Labeled label={t.openers}>
        {cast.openers.map(key => (
          <Avatar
            key={key}
            characterKey={key}
            className={cn(avatar, "border-border bg-surface-secondary")}
          />
        ))}
      </Labeled>
    </>
  )
}

type LabeledProps = { label: string; className?: string; children: ReactNode }

function Labeled({ label, className, children }: LabeledProps) {
  return (
    <span className={cn("flex items-center gap-1", className)}>
      <span className="mr-0.5 text-[12px] text-muted">{label}</span>
      {children}
    </span>
  )
}

function Avatar({ characterKey, className }: { characterKey: string; className: string }) {
  const entry = lookup("characters", characterKey)
  return (
    <GameIcon
      icon={entry.icon}
      label={entry.name}
      className={cn("rounded-full border", className)}
    />
  )
}
