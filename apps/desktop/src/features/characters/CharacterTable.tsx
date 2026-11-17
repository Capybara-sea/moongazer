// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronRight } from "lucide-react"
import { GameIcon } from "@/components/GameIcon"
import { RarityChip } from "@/components/RarityChip"
import { ELEMENT_ICONS } from "@/domain/elements"
import type { Character } from "@/domain/good"
import { characterData } from "@/domain/names"
import { cn } from "@/lib/cn"
import { navigate } from "@/lib/route"
import { text } from "@/text/zh"
import { SetIcon, Talents, WeaponIcon } from "./CharacterCard"
import { type CardInfo, traits } from "./cardInfo"
import { ELEMENT_TINT } from "./elementStyles"

const t = text.characters
const GRID =
  "grid grid-cols-[minmax(190px,1.5fr)_52px_48px_48px_92px_minmax(170px,1.3fr)_minmax(210px,1.6fr)_16px] gap-3"
const COLUMNS = [
  t.character,
  t.level,
  t.constellation,
  t.friendship,
  t.talents,
  t.weapon,
  t.artifacts,
  "",
]

type Props = { characters: readonly Character[]; infos: Map<string, CardInfo> }

/**
 * The characters as rows in one glass frame, with what the cards show; a row
 * opens the character's details. Scrolls sideways in a narrow window.
 */
export function CharacterTable({ characters, infos }: Props) {
  return (
    <section
      aria-label={t.list}
      className="glass overflow-x-auto rounded-[14px] border border-border bg-surface"
    >
      <div className="min-w-[960px]">
        <div
          className={cn(GRID, "border-(--separator) border-b px-4 py-2.5 text-[12px] text-muted")}
        >
          {COLUMNS.map(column => (
            <span key={column}>{column}</span>
          ))}
        </div>
        {characters.map(character => {
          const info = infos.get(character.key)
          return info && <Row key={character.key} character={character} info={info} />
        })}
      </div>
    </section>
  )
}

function Row({ character, info }: { character: Character; info: CardInfo }) {
  const data = characterData(character.key)
  return (
    // The rise is on a wrapper: on the button, its transition would replace the hover's.
    <div data-rise>
      <button
        type="button"
        onClick={() => navigate("characters", character.key)}
        className={cn(
          GRID,
          "w-full cursor-pointer items-center border-(--separator) border-b px-4 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-default/60 focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2 motion-reduce:transition-none",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {/* Hidden: the name beside it says the same. */}
          <span aria-hidden className="contents">
            <GameIcon
              icon={data.icon}
              label={data.name}
              className={cn(
                "size-9 rounded-[9px] border text-[15px]",
                data.element ? ELEMENT_TINT[data.element] : "border-border bg-surface-secondary",
              )}
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-semibold">{data.name}</span>
              {data.rarity !== undefined && (
                <RarityChip rarity={data.rarity} className="px-[5px] py-0" />
              )}
            </span>
            <span className="flex min-w-0 items-center gap-1 text-[12px] text-muted">
              {data.element && (
                <span aria-hidden className="contents">
                  <GameIcon
                    icon={ELEMENT_ICONS[data.element]}
                    label={text.game.elementLong(text.game.elements[data.element])}
                    className="size-3 text-[8px]"
                  />
                </span>
              )}
              <span className="truncate">{traits(data)}</span>
            </span>
          </span>
        </span>
        <span className="tabular">{character.level}</span>
        <span className="tabular">{t.constellationValue(character.constellation)}</span>
        <span className="tabular">{info.friendship ?? text.number.missing}</span>
        <span className="flex gap-0.5 whitespace-nowrap tabular">
          <Talents talents={info.talents} />
        </span>
        {info.weapon ? (
          <span className="flex min-w-0 items-center gap-2">
            <WeaponIcon weapon={info.weapon} className="size-[26px]" />
            <span className="min-w-0 truncate">{info.weapon.name}</span>
            <span className="flex-none text-[12px] text-muted tabular">
              {t.refinement(info.weapon.refinement)}
            </span>
          </span>
        ) : (
          <span className="truncate text-muted">{t.noWeapon}</span>
        )}
        {info.sets === undefined ? (
          <span className="truncate text-muted">{t.noArtifacts}</span>
        ) : (
          <span className="flex min-w-0 items-center gap-3">
            {info.sets.map(set => (
              <span key={set.key} className="flex min-w-0 items-center gap-1.5">
                <SetIcon set={set} className="size-[26px]" />
                <span className="min-w-0 truncate">{set.name}</span>
                <span className="flex-none text-[12px] text-muted tabular">
                  {t.pieces(set.count)}
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronRight aria-hidden size={16} className="text-muted" />
      </button>
    </div>
  )
}
