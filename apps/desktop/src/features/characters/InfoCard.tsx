// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Heart } from "lucide-react"
import type { ReactNode } from "react"
import { Panel } from "@/components/Panel"
import { RarityChip } from "@/components/RarityChip"
import { Tip } from "@/components/Tip"
import { levelCap } from "@/domain/builds"
import type { Character, CharacterInfo } from "@/domain/good"
import { characterData, characterProfile } from "@/domain/names"
import { text } from "@/i18n"
import { formatDate } from "@/lib/format"
import { CharacterAvatar } from "./CharacterAvatar"
import { ascended } from "./detail"

type Props = {
  character: Character
  info?: CharacterInfo
}

/**
 * Avatar, name and title; Vision with its element, constellation and weapon type; join date.
 * Then level, with a star once ascended for it, constellation and friendship.
 */
export function InfoCard({ character, info }: Props) {
  const data = characterData(character.key)
  const profile = characterProfile(character.key)
  const t = text.characterDetail
  const traits = [
    profile &&
      data.element &&
      t.vision(profile.vision || t.visionDefault, text.game.elements[data.element]),
    profile && t.constellationName(profile.constellation),
    data.weapon && text.game.weaponTypes[data.weapon],
  ].filter(part => typeof part === "string")
  return (
    <Panel
      aria-label={text.characterDetail.info}
      className="flex-row flex-wrap items-center gap-5 rounded-[18px]"
    >
      <div className="flex min-w-0 flex-[1_1_400px] items-center gap-4.5">
        <CharacterAvatar characterKey={character.key} size="hero" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="min-w-0 truncate font-semibold text-[24px] leading-[1.3]">
              {data.name}
            </h1>
            {data.rarity !== undefined && (
              <RarityChip rarity={data.rarity} className="px-[7px] text-[12px]" />
            )}
          </div>
          {profile?.title && <span className="text-[13px] text-muted">{profile.title}</span>}
          {traits.length > 0 && (
            <span className="flex gap-x-3 whitespace-nowrap text-[12px] text-muted">
              {traits.map(part => (
                <span key={part}>{part}</span>
              ))}
            </span>
          )}
          {info?.obtainedAt !== undefined && (
            <span className="tabular text-[12px] text-muted">
              {text.characterDetail.joined(formatDate(info.obtainedAt))}
            </span>
          )}
        </div>
      </div>
      <div className="grid flex-[1_1_300px] grid-cols-3 gap-2">
        <Stat label={text.characterDetail.level}>
          {character.level}
          <span className="font-normal text-[12px] text-muted">
            {text.characterDetail.levelCap(levelCap(character.ascension))}
          </span>
          {ascended(character.level, character.ascension) && (
            <Tip content={text.characterDetail.ascended(character.ascension)} className="contents">
              {/* Drawn after the game's own star (UI_IconKira), which the icon hosts do not serve. */}
              <svg
                role="img"
                aria-label={text.characterDetail.ascended(character.ascension)}
                viewBox="0 0 24 24"
                className="ml-1.5 inline size-3.5 align-[-1px] text-(--gold-fg)"
              >
                <path
                  fill="currentColor"
                  d="M12 0Q13.2 10.8 24 12Q13.2 13.2 12 24Q10.8 13.2 0 12Q10.8 10.8 12 0Z"
                />
              </svg>
            </Tip>
          )}
        </Stat>
        <Stat label={text.characterDetail.constellation}>
          {text.characters.constellationValue(character.constellation)}
        </Stat>
        <Stat label={text.characterDetail.friendship}>
          <span className="flex items-center gap-[5px]">
            <Heart aria-hidden className="size-[15px] text-muted" />
            {info?.friendship ?? text.number.missing}
          </span>
        </Stat>
      </div>
    </Panel>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="glass-inset flex min-w-0 flex-col gap-0.5 rounded-[12px] bg-surface-secondary px-3 py-2.5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="tabular font-semibold text-[18px]">{children}</span>
    </div>
  )
}
