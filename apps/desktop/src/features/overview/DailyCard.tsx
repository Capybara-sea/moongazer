// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Check, Gift } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { Bar } from "@/components/Bar"
import { DoneBadge } from "@/components/DoneBadge"
import { GameIcon } from "@/components/GameIcon"
import { Panel } from "@/components/Panel"
import { Tip } from "@/components/Tip"
import type { Account, Tasks } from "@/domain/account"
import {
  currentBosses,
  currentCommissions,
  currentWelkin,
  formatDuration,
  projectResin,
  RESIN_CAP,
  ratio,
  transformerState,
} from "@/domain/daily"
import { lookup } from "@/domain/names"
import { cn } from "@/lib/cn"
import { formatDateTime, formatMonthDay, formatNumber, formatTime } from "@/lib/format"
import { useNow } from "@/lib/useNow"
import { text } from "@/text/zh"

const t = text.daily

const FADE = "transition-colors duration-200 motion-reduce:transition-none"

const CHIPS = {
  left: "bg-surface-secondary text-muted",
  claimable: "bg-(--gold-bg) text-(--gold-fg)",
  claimed: "bg-(--accent-soft) text-(--accent-text)",
} as const

const slots = (n: number) => Array.from({ length: n }, (_, i) => i)
const monthDayTime = (ms: number) => `${formatMonthDay(ms)} ${formatTime(ms)}`

/**
 * Today's tasks, one graphic per row. Counts are the snapshot's, started over
 * when a reset has passed since; what the export gives as times moves on to now.
 */
export function DailyCard({ account, takenAt }: { account: Account; takenAt: number }) {
  const now = useNow()
  const tasks = account.tasks
  return (
    <Panel aria-label={t.title} className="min-w-0 flex-[1_1_380px] gap-0 px-[18px] pt-3.5 pb-2">
      <div className="flex items-baseline justify-between gap-2 pb-1.5">
        <h2 className="font-semibold text-base">{t.title}</h2>
        <span className="tabular text-[12px] text-muted">{t.asOf(monthDayTime(takenAt))}</span>
      </div>
      {/* One grid for all rows, so the values take one width and the bars end together. */}
      <div className="grid grid-cols-[76px_minmax(0,1fr)_auto] gap-x-3.5">
        <Resin resin={tasks?.resin} now={now} />
        <Commissions commissions={tasks?.commissions} takenAt={takenAt} now={now} />
        <Realm realm={tasks?.realm} />
        <Bosses bosses={tasks?.weeklyBosses} takenAt={takenAt} now={now} />
        <Expeditions expeditions={tasks?.expeditions} now={now} />
        <Transformer transformer={tasks?.transformer} now={now} />
        <Welkin welkin={tasks?.welkin} takenAt={takenAt} now={now} />
      </div>
    </Panel>
  )
}

type RowProps = {
  label: string
  value?: ReactNode
  /** Hover text for the whole row. */
  tip?: string
  className?: string
  children: ReactNode
}

function Row({ label, value, tip, className, children }: RowProps) {
  return (
    <Tip
      as="div"
      content={tip}
      className={cn(
        "col-span-full grid min-h-[46px] grid-cols-subgrid items-center border-(--separator) border-t py-1.5 text-[13px]",
        className,
      )}
    >
      <span className="whitespace-nowrap text-muted">{label}</span>
      {children}
      {/* Pinned to the value column: a row may leave the middle empty (Welkin with no days). */}
      <span className="tabular col-start-3 whitespace-nowrap text-right font-semibold">
        {value}
      </span>
    </Tip>
  )
}

function Missing({ label, tip }: { label: string; tip?: string }) {
  return (
    <Row label={label} tip={tip}>
      <span className="text-muted">{text.snapshot.notRead}</span>
    </Row>
  )
}

type MeterProps = { value: number; tone?: ComponentProps<typeof Bar>["tone"]; note?: string }

function Meter({ value, tone, note }: MeterProps) {
  return (
    <span className="flex min-w-0 flex-col gap-[3px]">
      <Bar value={value} tone={tone} />
      {note && <span className="truncate text-[11px] text-muted">{note}</span>}
    </span>
  )
}

function Resin({ resin, now }: { resin: Tasks["resin"]; now: number }) {
  if (!resin) return <Missing label={t.resin} />
  const { value, fullAt } = projectResin(resin, now)
  const note =
    value >= RESIN_CAP
      ? t.resinFull
      : fullAt !== undefined
        ? t.resinFullIn(formatDuration(fullAt - now))
        : undefined
  return (
    <Row label={t.resin} value={`${formatNumber(value)} / ${RESIN_CAP}`}>
      <Meter value={value / RESIN_CAP} note={note} />
    </Row>
  )
}

type CommissionsProps = { commissions: Tasks["commissions"]; takenAt: number; now: number }

function Commissions({ commissions, takenAt, now }: CommissionsProps) {
  if (!commissions) return <Missing label={t.commissions} tip={t.commissionsNotRead} />
  const { finished, total, claimed, reset } = currentCommissions(commissions, takenAt, now)
  const state = claimed ? "claimed" : finished >= total ? "claimable" : "left"
  return (
    <Row label={t.commissions} value={`${finished} / ${total}`} tip={reset ? t.reset : undefined}>
      <span className="flex min-w-0 items-center gap-1.5">
        {slots(total).map(n => (
          <span
            key={n}
            aria-hidden
            className={cn(
              "size-3.5 flex-none rounded-full border-2",
              FADE,
              n < finished ? "border-accent bg-accent" : "border-(--field-border)",
            )}
          />
        ))}
        <span
          className={cn(
            "ml-1.5 flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px]",
            FADE,
            CHIPS[state],
          )}
        >
          {state === "claimable" && <Gift aria-hidden className="size-[13px]" />}
          {state === "claimed" && <Check aria-hidden className="size-[13px]" strokeWidth={2.5} />}
          {state === "left"
            ? t.commissionsLeft(total - finished)
            : state === "claimable"
              ? t.commissionsClaimable
              : t.commissionsClaimed}
        </span>
      </span>
    </Row>
  )
}

function Realm({ realm }: { realm: Tasks["realm"] }) {
  if (!realm) return <Missing label={t.realm} />
  const room = realm.limit - realm.value
  return (
    <Row label={t.realm} value={`${formatNumber(realm.value)} / ${formatNumber(realm.limit)}`}>
      <Meter
        value={ratio(realm.value, realm.limit)}
        note={room > 0 ? t.realmRoom(formatNumber(room)) : t.realmFull}
      />
    </Row>
  )
}

type BossesProps = { bosses: Tasks["weeklyBosses"]; takenAt: number; now: number }

function Bosses({ bosses, takenAt, now }: BossesProps) {
  if (!bosses) return <Missing label={t.bosses} />
  const { left, limit, used, reset } = currentBosses(bosses, takenAt, now)
  return (
    <Row label={t.bosses} value={t.bossesLeft(left, limit)} tip={reset ? t.reset : undefined}>
      <span className="flex min-w-0 items-center gap-1.5">
        {slots(limit).map(n => (
          <span
            key={n}
            aria-hidden
            className={cn(
              "h-2.5 w-[26px] flex-none rounded-full border",
              FADE,
              n < used ? "border-(--field-border) bg-surface-secondary" : "border-accent bg-accent",
            )}
          />
        ))}
        <span className="ml-1 truncate text-[11px] text-muted">{t.bossesUsed(used)}</span>
      </span>
    </Row>
  )
}

function Expeditions({ expeditions, now }: { expeditions: Tasks["expeditions"]; now: number }) {
  if (!expeditions) return <Missing label={t.expeditions} />
  const done = expeditions.filter(e => e.doneAt <= now).length
  return (
    <Row
      label={t.expeditions}
      value={expeditions.length > 0 ? t.expeditionsDone(done, expeditions.length) : undefined}
      className="py-2"
    >
      {expeditions.length > 0 ? (
        <span className="flex min-w-0 flex-wrap gap-2.5">
          {expeditions.map(e => (
            <Expedition key={`${e.character}-${e.doneAt}`} {...e} now={now} />
          ))}
        </span>
      ) : (
        <span className="text-muted">{t.noExpeditions}</span>
      )}
    </Row>
  )
}

type ExpeditionProps = { character?: string; doneAt: number; now: number }

function Expedition({ character, doneAt, now }: ExpeditionProps) {
  const done = doneAt <= now
  const entry = character === undefined ? undefined : lookup("characters", character)
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className="relative">
        <GameIcon
          icon={entry?.icon}
          label={entry?.name ?? ""}
          className={cn(
            "size-[30px] rounded-full border-2 bg-surface-secondary text-[12px]",
            FADE,
            done ? "border-(--ok)" : "border-border",
          )}
        />
        {done && <DoneBadge />}
      </span>
      <Tip
        content={formatDateTime(doneAt)}
        className={cn(
          "tabular whitespace-nowrap text-[10px]",
          done ? "text-(--accent-text)" : "text-muted",
        )}
      >
        {done ? t.expeditionDone : formatTime(doneAt)}
      </Tip>
    </span>
  )
}

function Transformer({ transformer, now }: { transformer: Tasks["transformer"]; now: number }) {
  if (!transformer) return <Missing label={t.transformer} />
  const { ready, progress } = transformerState(transformer, now)
  return (
    <Row label={t.transformer} value={ready ? t.transformerReady : t.transformerCooling}>
      <Meter
        value={progress}
        tone={ready ? "accent" : "muted"}
        note={
          ready ? t.transformerReadySince : t.transformerReadyAt(monthDayTime(transformer.readyAt))
        }
      />
    </Row>
  )
}

type WelkinProps = { welkin: Tasks["welkin"]; takenAt: number; now: number }

function Welkin({ welkin, takenAt, now }: WelkinProps) {
  if (!welkin) return <Missing label={t.welkin} />
  const { days, endsAt, claimedToday } = currentWelkin(welkin.days, takenAt, now)
  // The row's tip covers the chip as well (only the outer tip opens), so it carries the chip's note.
  return (
    <Row
      label={t.welkin}
      value={days > 0 ? t.welkinDays(days) : t.welkinNone}
      tip={days > 0 ? `${t.welkinUntil(formatMonthDay(endsAt))}\n${t.welkinGuess}` : undefined}
    >
      {days > 0 && (
        <span
          className={cn(
            "flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px]",
            FADE,
            CHIPS[claimedToday ? "claimed" : "left"],
          )}
        >
          {claimedToday && <Check aria-hidden className="size-[13px]" strokeWidth={2.5} />}
          {claimedToday ? t.welkinClaimed : t.welkinUnclaimed}
        </span>
      )}
    </Row>
  )
}
