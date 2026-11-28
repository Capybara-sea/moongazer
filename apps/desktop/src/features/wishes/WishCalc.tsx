// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Minus, Plus, RotateCcw } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { GameIcon } from "@/components/GameIcon"
import { LabeledSelect } from "@/components/LabeledSelect"
import { Panel } from "@/components/Panel"
import { Segmented } from "@/components/Segmented"
import { Switch } from "@/components/Switch"
import { Tip } from "@/components/Tip"
import type { Account } from "@/domain/account"
import { lookup } from "@/domain/names"
import { budgetWishes, wishBudget } from "@/domain/wishBudget"
import type { PoolSummary } from "@/domain/wishes"
import {
  type CharacterState,
  chanceWithin,
  characterArrivals,
  meanWishes,
  refundPerWish,
  STRATEGIES,
  type Strategy,
  strategySteps,
  type WeaponState,
  weaponArrivals,
} from "@/domain/wishOdds"
import type { Snapshot } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { formatDateTime, formatNumber } from "@/lib/format"
import { text } from "@/text"
import { CalcTargets, copiesFor, type Target } from "./CalcTargets"
import { ChanceBar, StepChip } from "./calcParts"

const t = text.wishes.calc
const MAX_EXTRA = 250

type Props = {
  pools: readonly PoolSummary[]
  account: Account | undefined
  snapshot: Snapshot | undefined
  /** The Epitomized Path's points the records page goes by. */
  fate: number
}

/** The bag's currencies worked out in wishes, and what those wishes likely bring. */
export function WishCalc({ pools, account, snapshot, fate }: Props) {
  const [genesis, setGenesis] = useState(true)
  const [refund, setRefund] = useState(true)
  const [extra, setExtra] = useState(0)
  const [mode, setMode] = useState<"simple" | "multi">("simple")
  const [strategy, setStrategy] = useState<Strategy>(0)
  const [targets, setTargets] = useState<Target[]>([])
  const character = pools.find(pool => pool.key === "character")
  const weapon = pools.find(pool => pool.key === "weapon")
  const recorded: { character: CharacterState; weapon: WeaponState } = {
    character: {
      pity: character?.pity ?? 0,
      guaranteed: character?.guaranteed ?? false,
      radiance: character?.radiance ?? 0,
    },
    weapon: { pity: weapon?.pity ?? 0, guaranteed: weapon?.guaranteed ?? false, fate },
  }
  const [edited, setEdited] = useState<typeof recorded | null>(null)
  const state = edited ?? recorded

  const budget = useMemo(() => wishBudget(account, Date.now()), [account])
  const parts = budgetWishes(budget, genesis)
  const perWish = refundPerWish(budget.fourStars > 0 ? budget.maxed / budget.fourStars : 0)
  const have = parts.total
  const raw = have + extra
  const total = refund ? Math.floor(raw / (1 - perWish.fates)) : raw
  const returned = total - raw

  const copies = { characters: 0, weapons: 0 }
  for (const target of targets) copies[target.kind] += copiesFor(target, account)
  const characterCopies = Math.max(7, mode === "multi" ? copies.characters : 0)
  const weaponCopies = Math.max(5, mode === "multi" ? copies.weapons : 0)
  const c = state.character
  const w = state.weapon
  const characters = useMemo(
    () =>
      characterArrivals(
        { pity: c.pity, guaranteed: c.guaranteed, radiance: c.radiance },
        characterCopies,
      ),
    [c.pity, c.guaranteed, c.radiance, characterCopies],
  )
  const weapons = useMemo(
    () => weaponArrivals({ pity: w.pity, guaranteed: w.guaranteed, fate: w.fate }, weaponCopies),
    [w.pity, w.guaranteed, w.fate, weaponCopies],
  )
  const odds = (chars: number, weaps: number) => ({
    chance: chanceWithin(characters, chars, weapons, weaps, total),
    mean: Math.round(meanWishes(characters, chars, weapons, weaps)),
  })
  const edit = (change: (s: typeof recorded) => typeof recorded) => setEdited(change(state))

  const resources: { key: string; have: number; side: ReactNode; dim?: boolean }[] = [
    { key: "IntertwinedFate", have: budget.fates, side: t.pulls(parts.fates) },
    { key: "Primogem", have: budget.primogems, side: t.pulls(parts.primogems) },
    { key: "MasterlessStarglitter", have: budget.starglitter, side: t.pulls(parts.starglitter) },
    {
      key: "MasterlessStardust",
      have: budget.stardust,
      side: budget.stardustRead ? (
        t.stardust(parts.stardust)
      ) : (
        <Tip content={t.stardustGuess}>{t.stardust(parts.stardust)}</Tip>
      ),
    },
    {
      key: "GenesisCrystal",
      have: budget.genesis,
      dim: !genesis,
      side: (
        <button
          type="button"
          aria-pressed={genesis}
          aria-label={t.genesisLabel}
          onClick={() => setGenesis(!genesis)}
          className={cn(
            "h-6 cursor-pointer rounded-full border px-2.5 text-[11px]",
            genesis ? "border-accent bg-(--accent-soft)" : "border-border",
          )}
        >
          {genesis ? t.genesisOn(budgetWishes(budget, true).genesis) : t.genesisOff}
        </button>
      ),
    },
  ]

  return (
    <Panel aria-label={t.title} className="gap-4 p-[18px]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-semibold text-[15px]">{t.title}</h2>
        <span className="text-[12px] text-muted">
          {snapshot && account ? t.sub(formatDateTime(snapshot.takenAt)) : t.noBag}
        </span>
      </div>
      <div className="grid items-start gap-4 [grid-template-columns:300px_minmax(0,1fr)] max-[860px]:grid-cols-1">
        <div className="flex flex-col gap-3.5 rounded-[12px] bg-surface-secondary p-4">
          <div className="flex flex-col gap-0.5 rounded-[10px] bg-(--accent-soft) px-3.5 py-3">
            <span className="text-[12px] text-muted">{t.total}</span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-semibold text-[34px] leading-[1.1] tabular">
                {formatNumber(total)}
              </span>
              <span className="text-[14px]">{t.unit}</span>
              <span className="ml-auto text-[12px] text-muted tabular">
                {[
                  `${t.parts.have} ${have}`,
                  ...(refund ? [`${t.parts.refund} ${returned}`] : []),
                  ...(extra > 0 ? [`${t.parts.extra} ${extra}`] : []),
                ].join(" + ")}
              </span>
            </span>
            <span className="text-[12px] text-muted">{t.acquaint(budget.acquaint)}</span>
          </div>
          <ul className="flex flex-col">
            {resources.map(row => {
              const { name, icon } = lookup("materials", row.key)
              return (
                <li
                  key={row.key}
                  className={cn(
                    "flex h-[38px] items-center gap-2.5 border-(--separator) border-b px-1",
                    row.dim && "opacity-75",
                  )}
                >
                  <GameIcon icon={icon} label={name} className="size-[30px] rounded-[6px]" />
                  <b className="font-semibold text-[14px] tabular">{formatNumber(row.have)}</b>
                  <span className="flex-1" />
                  <span className="text-[12px] text-muted tabular">{row.side}</span>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center gap-2.5 px-1">
            <GameIcon
              icon={lookup("materials", "MasterlessStarglitter").icon}
              label={t.refund}
              className="size-[30px] rounded-[6px]"
            />
            <span className="mr-auto flex min-w-0 flex-col">
              <span className="text-[13px]">{t.refund}</span>
              <span className="text-[11px] text-muted tabular">
                {refund
                  ? t.refundNote(
                      returned,
                      perWish.starglitter.toFixed(2),
                      budget.maxed,
                      budget.fourStars,
                    )
                  : t.refundOff}
              </span>
            </span>
            <Switch checked={refund} label={t.refundLabel} onChange={setRefund} />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="mr-auto flex flex-col">
              <b className="font-semibold text-[13px]">{t.extra}</b>
              <span className="text-[11px] text-muted">{t.extraHint}</span>
            </span>
            <span className="flex items-center rounded-[8px] border border-(--field-border) bg-field">
              <button
                type="button"
                aria-label={t.extraDec}
                onClick={() => setExtra(Math.max(0, extra - 10))}
                className="flex h-8 w-[30px] cursor-pointer items-center justify-center text-muted"
              >
                <Minus aria-hidden size={14} />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_EXTRA}
                aria-label={t.extra}
                value={extra}
                onChange={e => setExtra(clamp(e.currentTarget.valueAsNumber, MAX_EXTRA))}
                className="h-8 w-12 bg-transparent text-center font-semibold text-[14px] tabular [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label={t.extraInc}
                onClick={() => setExtra(Math.min(MAX_EXTRA, extra + 10))}
                className="flex h-8 w-[30px] cursor-pointer items-center justify-center text-muted"
              >
                <Plus aria-hidden size={14} />
              </button>
            </span>
          </div>
          <span aria-hidden className="h-px bg-(--separator)" />
          <div className="flex items-start gap-2">
            <span className="mr-auto flex flex-col">
              <b className="font-semibold text-[13px]">{t.pityTitle}</b>
              <span className="text-[11px] text-muted">{t.pityHint}</span>
            </span>
            {edited && (
              <Tip content={t.pityReset} className="contents">
                <button
                  type="button"
                  aria-label={t.pityReset}
                  onClick={() => setEdited(null)}
                  className="flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-default/60"
                >
                  <RotateCcw aria-hidden size={14} />
                </button>
              </Tip>
            )}
          </div>
          <PityFields
            title={text.wishes.pools.character}
            pity={c.pity}
            of={90}
            guaranteed={c.guaranteed}
            third={{ label: t.fields.radiance, value: c.radiance, of: 3 }}
            onPity={pity => edit(s => ({ ...s, character: { ...s.character, pity } }))}
            onGuaranteed={g => edit(s => ({ ...s, character: { ...s.character, guaranteed: g } }))}
            onThird={radiance => edit(s => ({ ...s, character: { ...s.character, radiance } }))}
          />
          <PityFields
            title={text.wishes.pools.weapon}
            pity={w.pity}
            of={80}
            guaranteed={w.guaranteed}
            third={{ label: t.fields.fate, value: w.fate, of: 1 }}
            onPity={pity => edit(s => ({ ...s, weapon: { ...s.weapon, pity } }))}
            onGuaranteed={g => edit(s => ({ ...s, weapon: { ...s.weapon, guaranteed: g } }))}
            onThird={value => edit(s => ({ ...s, weapon: { ...s.weapon, fate: value } }))}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Segmented
            label={t.modeLabel}
            value={mode}
            options={(["simple", "multi"] as const).map(m => ({ value: m, label: t.modes[m] }))}
            onPick={setMode}
            className="grid grid-cols-2"
          />
          {mode === "simple" ? (
            <SimpleTable strategy={strategy} onStrategy={setStrategy} total={total} odds={odds} />
          ) : (
            <CalcTargets account={account} targets={targets} onTargets={setTargets} odds={odds} />
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted leading-[1.6]">{t.model}</p>
    </Panel>
  )
}

const clamp = (value: number, max: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0

type PityProps = {
  title: string
  pity: number
  of: number
  guaranteed: boolean
  third: { label: string; value: number; of: number }
  onPity: (pity: number) => void
  onGuaranteed: (guaranteed: boolean) => void
  onThird: (value: number) => void
}

/** A banner's pity, guarantee and third count (Capturing Radiance or Fate Points), editable. */
function PityFields({
  title,
  pity,
  of,
  guaranteed,
  third,
  onPity,
  onGuaranteed,
  onThird,
}: PityProps) {
  const field =
    "flex min-w-0 flex-col items-start rounded-[8px] border border-(--field-border) bg-field px-2 py-1 text-left"
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-muted">{title}</span>
      <div className="grid grid-cols-3 gap-1.5">
        <label className={field}>
          <span className="text-[10px] text-muted">{t.fields.pity}</span>
          <input
            type="number"
            min={0}
            max={of - 1}
            value={pity}
            onChange={e => onPity(clamp(e.currentTarget.valueAsNumber, of - 1))}
            className="w-full bg-transparent font-semibold text-[14px] tabular outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
        </label>
        <button
          type="button"
          aria-pressed={guaranteed}
          onClick={() => onGuaranteed(!guaranteed)}
          className={cn(field, "cursor-pointer")}
        >
          <span className="text-[10px] text-muted">{t.fields.guarantee}</span>
          <span
            className={cn(
              "font-semibold text-[14px]",
              guaranteed ? "text-(--accent-text)" : "text-foreground",
            )}
          >
            {guaranteed ? t.guaranteed : t.small}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onThird((third.value + 1) % (third.of + 1))}
          className={cn(field, "cursor-pointer")}
        >
          <span className="text-[10px] text-muted">{third.label}</span>
          <span className="font-semibold text-[14px] tabular">
            {third.value} / {third.of}
          </span>
        </button>
      </div>
    </div>
  )
}

type Odds = (characters: number, weapons: number) => { chance: number; mean: number }

/** The strategy's steps for the banners' featured character and weapon, each with its chance. */
function SimpleTable({
  strategy,
  onStrategy,
  total,
  odds,
}: {
  strategy: Strategy
  onStrategy: (strategy: Strategy) => void
  total: number
  odds: Odds
}) {
  const fateIcon = lookup("materials", "IntertwinedFate").icon
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <LabeledSelect
          label={t.strategy}
          value={String(strategy)}
          options={STRATEGIES.map(s => ({ value: String(s), label: t.strategyLabel(s) }))}
          onChange={value => onStrategy(STRATEGIES.find(s => String(s) === value) ?? 0)}
          className="w-[180px]"
        />
        <span className="text-[12px] text-muted">{t.strategyNote(strategy)}</span>
      </div>
      <table className="w-full border-separate border-spacing-y-1 text-[13px] tabular">
        <thead>
          <tr className="text-[12px] text-muted">
            <th scope="col" className="w-[150px] px-3 text-left font-medium">
              {t.target}
            </th>
            <th scope="col" className="px-3 text-left font-medium">
              {t.chance(total)}
            </th>
            <th scope="col" className="w-[140px] px-3 text-right font-medium">
              {t.mean}
            </th>
          </tr>
        </thead>
        <tbody>
          {strategySteps(strategy).map(step => {
            const { chance, mean } = odds(step.characters, step.weapons)
            return (
              <tr
                key={`${step.characters}-${step.weapons}`}
                className={cn(chance < 0.01 && "opacity-50")}
              >
                <th
                  scope="row"
                  className="rounded-l-[8px] bg-surface-secondary px-3 py-1.5 text-left font-normal"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {step.characters > 0 && (
                      <StepChip kind="characters" count={step.characters - 1} />
                    )}
                    {step.weapons > 0 && <StepChip kind="weapons" count={step.weapons} />}
                  </span>
                </th>
                <td className="bg-surface-secondary px-3 py-1.5">
                  <ChanceBar chance={chance} />
                </td>
                <td className="rounded-r-[8px] bg-surface-secondary px-3 py-1.5 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    {formatNumber(mean)}
                    <GameIcon
                      icon={fateIcon}
                      label={t.unit}
                      className="size-[18px] rounded-[4px]"
                    />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
