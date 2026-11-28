// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button, Popover } from "@heroui/react"
import { Settings2 } from "lucide-react"
import { LabeledSelect } from "@/components/LabeledSelect"
import { Segmented } from "@/components/Segmented"
import { Switch } from "@/components/Switch"
import { CONVERT_KINDS, type ConvertKind } from "@/domain/convert"
import { FOCUSES, type Plan } from "@/domain/plan"
import type { Defaults } from "@/domain/planDefaults"
import { characterCaps, type Stage, stages, weaponCaps } from "@/domain/planner"
import { text } from "@/i18n"
import { usePlannerStore } from "@/stores/plannerStore"
import { stageLabel } from "./GoalCard"
import { RankBadge } from "./RankBadge"

const t = text.planner
const RANKS = [0, 1, 2] as const
const TALENT_LEVELS = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

const stageValue = (stage: Stage) => `${stage.level}/${stage.phase}`

function stageOptions(caps: readonly number[]) {
  return stages(caps).map(stage => ({ value: stageValue(stage), label: stageLabel(stage, caps) }))
}

function pickStage(caps: readonly number[], value: string) {
  return stages(caps).find(stage => stageValue(stage) === value)
}

const setDefaults = (edit: (defaults: Defaults) => Defaults) =>
  usePlannerStore.getState().change(plan => ({ ...plan, defaults: edit(plan.defaults) }))

const setConvert = (kind: ConvertKind, on: boolean) =>
  usePlannerStore.getState().change(plan => {
    const convert = CONVERT_KINDS.filter(k => (k === kind ? on : plan.convert?.includes(k)))
    return { ...plan, convert: convert.length > 0 ? convert : undefined }
  })

/**
 * The planner's settings: how talents are recommended, what new goals aim
 * at, and which conversions the plan counts on.
 */
export function PlannerSettings({ plan }: { plan: Plan }) {
  const { focus, defaults, convert = [] } = plan
  const characterStage = (stage: Stage) =>
    setDefaults(d => ({ ...d, character: { ...d.character, stage } }))
  const talent = (rank: 0 | 1 | 2, level: number) =>
    setDefaults(d => {
      const talents: Defaults["character"]["talents"] = [...d.character.talents]
      talents[rank] = level
      return { ...d, character: { ...d.character, talents } }
    })
  return (
    <Popover>
      <Button variant="secondary">
        <Settings2 aria-hidden size={15} />
        {t.settings}
      </Button>
      <Popover.Content
        placement="bottom end"
        offset={6}
        className="glass w-[400px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
      >
        <Popover.Dialog
          aria-label={t.settingsLabel}
          className="flex flex-col gap-4 p-4 text-[13px] outline-none"
        >
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">{t.focusLabel}</h3>
            <Segmented
              label={t.focusLabel}
              value={focus}
              options={FOCUSES.map(option => ({ value: option, label: t.focus[option] }))}
              onPick={option => usePlannerStore.getState().change(p => ({ ...p, focus: option }))}
              className="self-start"
            />
            <ul className="flex flex-col gap-1 text-[12px] text-muted leading-[1.6]">
              {t.focusDetail.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-2 border-border border-t pt-3">
            <h3 className="font-semibold">{t.convertTitle}</h3>
            {CONVERT_KINDS.map(kind => (
              <div key={kind} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span>{t.convert[kind]}</span>
                  <span className="text-[12px] text-muted">{t.convertDetail[kind]}</span>
                </div>
                <Switch
                  checked={convert.includes(kind)}
                  label={t.convertLabel(t.convert[kind])}
                  onChange={on => setConvert(kind, on)}
                />
              </div>
            ))}
          </section>
          <section className="flex flex-col gap-2 border-border border-t pt-3">
            <h3 className="font-semibold">{t.newCharacter}</h3>
            <LabeledSelect
              label={t.level}
              value={stageValue(defaults.character.stage)}
              options={stageOptions(characterCaps())}
              onChange={value => {
                const stage = pickStage(characterCaps(), value)
                if (stage) characterStage(stage)
              }}
              className="w-[140px]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">{t.defaultTalents}</span>
              {RANKS.map(rank => (
                <LabeledSelect
                  key={rank}
                  label={t.rankLabel(rank + 1)}
                  mark={<RankBadge rank={rank} />}
                  value={String(defaults.character.talents[rank])}
                  options={TALENT_LEVELS}
                  onChange={value => talent(rank, Number(value))}
                  className="w-[76px]"
                />
              ))}
            </div>
            <p className="text-[12px] text-muted">{t.talentsRaiseLevel}</p>
          </section>
          <section className="flex flex-col gap-2 border-border border-t pt-3">
            <h3 className="font-semibold">{t.newWeapon}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <LabeledSelect
                label={t.level}
                value={stageValue(defaults.weapon)}
                options={stageOptions(weaponCaps(5))}
                onChange={value => {
                  const stage = pickStage(weaponCaps(5), value)
                  if (stage) setDefaults(d => ({ ...d, weapon: stage }))
                }}
                className="w-[140px]"
              />
              <span className="text-[12px] text-muted">{t.lowWeaponCap}</span>
            </div>
          </section>
          <p className="text-[12px] text-muted">{t.defaultsHint}</p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
