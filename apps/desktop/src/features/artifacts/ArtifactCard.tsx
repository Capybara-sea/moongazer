// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Lock, Star } from "lucide-react"
import { GameIcon } from "@/components/GameIcon"
import { RARITY_TONES } from "@/components/RarityChip"
import { SetEffectTooltip } from "@/components/SetEffectTooltip"
import { artifactIcon, formatStat, mainStatValue, statName } from "@/domain/builds"
import type { Substat } from "@/domain/good"
import { cn } from "@/lib/cn"
import { text } from "@/text/zh"
import type { ArtifactRow } from "./order"

const t = text.artifacts

/**
 * One artifact, as in the design. Plain markup but for the set's tooltip,
 * which is a span until it opens: a page can hold a great many.
 */
export function ArtifactCard({ row }: { row: ArtifactRow }) {
  const { artifact, setName, wielder } = row
  const { slotKey, mainStatKey, level, rarity, totalRolls } = artifact
  const main = mainStatValue(rarity, mainStatKey, level)
  return (
    // Cards out of view skip layout and paint: with every card loaded, showing
    // the page again took close to a second without it.
    <article className="glass flex min-w-0 flex-col gap-2.5 rounded-[14px] border border-border bg-surface p-3.5 [contain-intrinsic-size:auto_260px] [content-visibility:auto]">
      <div className="flex items-center gap-3">
        {/* Hidden: the set and slot names next to it say the same. */}
        <span aria-hidden className="contents">
          <SetEffectTooltip setKey={artifact.setKey}>
            <GameIcon
              icon={artifactIcon(artifact.setKey, slotKey)}
              label={setName}
              className={cn(
                "size-11 rounded-[10px] text-[18px]",
                RARITY_TONES[rarity] ?? "bg-surface-secondary",
              )}
            />
          </SetEffectTooltip>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-[14px] leading-[1.4]">{setName}</h2>
          <div className="text-[12px] text-muted">{text.game.slots[slotKey]}</div>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          {artifact.astralMark && (
            <span title={t.astralMark} className="flex text-(--gold-fg)">
              <Star
                role="img"
                aria-label={t.astralMark}
                fill="currentColor"
                className="size-[15px]"
              />
            </span>
          )}
          {artifact.lock && (
            <span title={t.locked} className="flex text-muted">
              <Lock role="img" aria-label={t.locked} className="size-[15px]" />
            </span>
          )}
          <span className="tabular rounded-[6px] bg-surface-secondary px-2 py-0.5 font-semibold text-[12px]">
            {t.level(level)}
          </span>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">{statName(mainStatKey)}</span>
        <span className="tabular font-semibold text-[20px]">
          {main === undefined ? text.number.missing : formatStat(mainStatKey, main)}
        </span>
      </div>
      <ul className="grid gap-1 text-[13px]">
        {artifact.substats.map(substat => (
          <SubstatRow key={substat.key} substat={substat} />
        ))}
        {artifact.unactivatedSubstats.map(substat => (
          <SubstatRow key={`pending-${substat.key}`} substat={substat} pending />
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2 border-(--separator) border-t pt-2.5 text-[12px] text-muted">
        <span className={cn("min-w-0 truncate", wielder && "text-foreground")}>
          {wielder ? t.wielder(wielder) : t.unequipped}
        </span>
        <span className="flex flex-none items-center gap-1.5">
          {artifact.elixirCrafted && (
            <span className="rounded-[6px] bg-(--accent-soft) px-1.5 py-px text-(--accent-text)">
              {t.elixir}
            </span>
          )}
          {totalRolls !== undefined && <span className="tabular">{t.rolls(totalRolls)}</span>}
        </span>
      </div>
    </article>
  )
}

function SubstatRow({ substat, pending }: { substat: Substat; pending?: boolean }) {
  const name = statName(substat.key)
  return (
    <li className={cn("flex justify-between gap-2", pending && "text-muted")}>
      <span>{pending ? `${name}${t.pending}` : name}</span>
      <span className="tabular">{formatStat(substat.key, substat.value)}</span>
    </li>
  )
}
