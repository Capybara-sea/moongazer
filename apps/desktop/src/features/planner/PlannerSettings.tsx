// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button, Popover } from "@heroui/react"
import { Settings2 } from "lucide-react"
import { LabeledSelect } from "@/components/LabeledSelect"
import { FOCUSES, type Plan } from "@/domain/plan"
import type { Defaults } from "@/domain/planDefaults"
import { characterCaps, type Stage, stages, weaponCaps } from "@/domain/planner"
import { cn } from "@/lib/cn"
import { usePlannerStore } from "@/stores/plannerStore"
import { text } from "@/text/zh"
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

/** The planner's settings: how talents are recommended, and what new goals aim at. */
export function PlannerSettings({ plan }: { plan: Plan }) {
  const { focus, defaults } = plan
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
        className="glass w-[400px] max-w-[calc(100vw-32px)] rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
      >
        <Popover.Dialog
          aria-label={t.settingsLabel}
          className="flex flex-col gap-4 p-4 text-[13px] outline-none"
        >
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">{t.focusLabel}</h3>
            <fieldset
              aria-label={t.focusLabel}
              className="flex h-9 gap-0.5 self-start rounded-[9px] border border-(--field-border) bg-(--field-background) p-0.5"
            >
              {FOCUSES.map(option => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={option === focus}
                  onClick={() => usePlannerStore.getState().change(p => ({ ...p, focus: option }))}
                  className={cn(
                    "cursor-pointer rounded-[7px] px-2.5 transition-colors duration-150 motion-reduce:transition-none",
                    option === focus
                      ? "bg-(--accent-soft) text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {t.focus[option]}
                </button>
              ))}
            </fieldset>
            <ul className="flex flex-col gap-1 text-[12px] text-muted leading-[1.6]">
              {t.focusDetail.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
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
