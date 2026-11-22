// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Lock, Star } from "lucide-react"
import { GameIcon } from "@/components/GameIcon"
import { Panel } from "@/components/Panel"
import { iconTone } from "@/components/RarityChip"
import { SetEffectTooltip } from "@/components/SetEffectTooltip"
import { Tip } from "@/components/Tip"
import { artifactIcon, formatStat, mainStatValue, statName } from "@/domain/builds"
import type { Artifact, Substat } from "@/domain/good"
import { lookup } from "@/domain/names"
import { cn } from "@/lib/cn"
import { text } from "@/text/zh"
import { bySlot, setCounts } from "./artifacts"

const t = text.characterDetail

function setName(setKey: string) {
  return lookup("artifactSets", setKey).name
}

/** The character's artifacts with their main and sub stats. */
export function ArtifactsCard({ artifacts }: { artifacts: Artifact[] }) {
  const pieces = bySlot(artifacts)
  return (
    <Panel aria-label={t.artifacts} className="px-4.5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-[15px]">{t.artifacts}</h2>
        <div className="flex flex-wrap gap-1.5">
          {setCounts(pieces).map(({ setKey, count }) => (
            <SetEffectTooltip
              key={setKey}
              setKey={setKey}
              equipped={count}
              className="gap-1 rounded-[6px] border border-border px-2 py-0.5 text-[12px]"
            >
              {setName(setKey)}
              <span className="tabular text-muted">{t.pieces(count)}</span>
            </SetEffectTooltip>
          ))}
        </div>
      </div>
      {pieces.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5">
          {pieces.map(piece => (
            <Piece
              key={piece.slotKey}
              artifact={piece}
              equipped={pieces.filter(p => p.setKey === piece.setKey).length}
            />
          ))}
        </div>
      ) : (
        <span className="text-[13px] text-muted">{text.characters.noArtifacts}</span>
      )}
    </Panel>
  )
}

/** One piece; `equipped` is how many of the character's pieces are of its set. */
function Piece({ artifact, equipped }: { artifact: Artifact; equipped: number }) {
  const { setKey, slotKey, mainStatKey, level } = artifact
  const set = setName(setKey)
  const value = mainStatValue(artifact.rarity, mainStatKey, level)
  const hasSubstats = artifact.substats.length + artifact.unactivatedSubstats.length > 0
  return (
    <div className="glass-inset flex flex-col gap-2 rounded-[12px] bg-surface-secondary px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <SetEffectTooltip setKey={setKey} equipped={equipped}>
          <GameIcon
            icon={artifactIcon(setKey, slotKey)}
            label={set}
            className={cn("size-8.5 rounded-[8px] text-[14px]", iconTone(artifact.rarity))}
          />
        </SetEffectTooltip>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-[13px]">{statName(mainStatKey)}</div>
          <div className="truncate text-[11px] text-muted">
            {t.artifactPlace(text.game.slots[slotKey], set)}
          </div>
        </div>
        <div className="flex flex-none flex-col items-end">
          <span className="tabular font-semibold text-[16px]">
            {value === undefined ? text.number.missing : formatStat(mainStatKey, value)}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted">
            {artifact.astralMark && (
              <Tip content={t.astralMark} className="flex text-(--gold-fg)">
                <Star
                  role="img"
                  aria-label={t.astralMark}
                  fill="currentColor"
                  className="size-[13px]"
                />
              </Tip>
            )}
            {artifact.lock && (
              <Tip content={t.locked} className="flex">
                <Lock role="img" aria-label={t.locked} className="size-[13px]" />
              </Tip>
            )}
            <span className="tabular">{t.artifactLevel(level)}</span>
          </span>
        </div>
      </div>
      {hasSubstats && (
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-0.5 text-[12px]">
          {artifact.substats.map(substat => (
            <SubstatRow key={substat.key} substat={substat} />
          ))}
          {artifact.unactivatedSubstats.map(substat => (
            <SubstatRow key={`pending-${substat.key}`} substat={substat} pending />
          ))}
        </div>
      )}
    </div>
  )
}

function SubstatRow({ substat, pending }: { substat: Substat; pending?: boolean }) {
  const name = statName(substat.key)
  // A pending row spans both columns: with its suffix it does not fit in one.
  return (
    <div className={cn("flex min-w-0 justify-between gap-1.5", pending && "col-span-2 text-muted")}>
      <span className="truncate text-muted">{pending ? `${name}${t.pending}` : name}</span>
      <span className="tabular flex-none">{formatStat(substat.key, substat.value)}</span>
    </div>
  )
}
