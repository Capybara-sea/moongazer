// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Bar } from "@/components/Bar"
import { GameIcon } from "@/components/GameIcon"
import { HoverPreview } from "@/components/HoverPreview"
import { Panel } from "@/components/Panel"
import { type TalentKey, talentLevels } from "@/domain/builds"
import type { Character } from "@/domain/good"
import { characterData, characterProfile, characterTalents, constellations } from "@/domain/names"
import { cn } from "@/lib/cn"
import { text } from "@/text/zh"
import { ELEMENT_TEXT, ELEMENT_TINT } from "./elementStyles"

const CARD = "gap-3 px-4.5 py-4"
const CONSTELLATIONS = [1, 2, 3, 4, 5, 6]
const TALENTS: readonly TalentKey[] = ["auto", "skill", "burst"]
/** Exports cap base talent levels at 10. */
const MAX_TALENT = 10
const TILE =
  "glass-inset flex min-w-0 items-center gap-2.5 rounded-[10px] bg-surface-secondary px-2 py-2"
/**
 * The game's constellation and talent icons are white; the light theme inverts them. The
 * placeholder is hidden under an icon, or it shows through a faded one.
 */
const ICON =
  "size-8 flex-none rounded-full border text-[12px] [&:has(img)>span]:invisible [.light_&]:[&_img]:invert"
const FADED = "border-border [&_img]:opacity-40"

/**
 * Six tiles with icon and name, the activated ones in the character's element; resting the pointer
 * on one shows its effect.
 */
export function ConstellationCard({ character }: { character: Character }) {
  const t = text.characterDetail
  const element = characterData(character.key).element
  const list = constellations(character.key)
  const constellation = characterProfile(character.key)?.constellation
  const active = element
    ? // The border takes the element's full color through currentColor.
      cn(ELEMENT_TINT[element], ELEMENT_TEXT[element], "border-current")
    : "border-accent bg-(--accent-soft)"
  return (
    <Panel aria-label={t.constellations} className={CARD}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <h2 className="font-semibold text-[15px]">{t.constellations}</h2>
          {constellation && (
            <span className="truncate text-[13px] text-muted">{constellation}</span>
          )}
        </span>
        <span className="tabular text-[12px] text-muted">
          {t.activated(character.constellation)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CONSTELLATIONS.map(n => {
          const on = n <= character.constellation
          const item = list[n - 1]
          const tile = cn(TILE, !on && "text-muted")
          const content = (
            <>
              {/* Hidden: the text next to it says the same. */}
              <span aria-hidden className="contents">
                <GameIcon
                  icon={item?.icon}
                  label={String(n)}
                  className={cn(ICON, on ? active : FADED)}
                />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="tabular text-[11px] text-muted">{t.constellationLevel(n)}</span>
                {/* Some names are whole lines of verse: they wrap rather than cut off. */}
                <span className="text-[12px] leading-[1.4]">{item?.name}</span>
              </span>
            </>
          )
          return item?.text ? (
            <HoverPreview
              key={n}
              preview={
                <Description
                  name={item.name}
                  note={`${t.constellationLevel(n)} · ${on ? t.constellationActive : t.constellationInactive}`}
                  text={item.text}
                />
              }
              previewClassName="w-[340px] gap-1.5"
              className={tile}
            >
              {content}
            </HoverPreview>
          ) : (
            <div key={n} className={tile}>
              {content}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

/** A constellation's or a talent's name, a note on it and its description, for a hover preview. */
function Description({ name, note, text }: { name: string; note: string; text: string }) {
  return (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-[13px]">{name}</span>
        <span className="flex-none text-[11px] text-muted">{note}</span>
      </span>
      {/* The game's text has line breaks. */}
      <span className="whitespace-pre-line">{text}</span>
    </>
  )
}

/**
 * The three talents with their names, the constellation bonus in the level and the base level as
 * a bar; then the passive talents, those the character has not ascended far enough for faded.
 * Resting the pointer on any shows its description.
 */
export function TalentsCard({ character }: { character: Character }) {
  const t = text.characterDetail
  const levels = talentLevels(character)
  const { talents, passives } = characterTalents(character.key)
  return (
    <Panel aria-label={t.talents} className={CARD}>
      <h2 className="font-semibold text-[15px]">{t.talents}</h2>
      {TALENTS.map(talent => {
        const { base, total, boosted } = levels[talent]
        const maxed = base >= MAX_TALENT
        const info = talents?.[talent]
        const label = text.game.talents[talent]
        const row = (
          <>
            {info && (
              <span aria-hidden className="contents">
                <GameIcon
                  icon={info.icon}
                  label={info.name}
                  className={cn(ICON, "border-border")}
                />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">
                  {label}
                  {info && <span className="text-muted">{t.talentName(info.name)}</span>}
                </span>
                {maxed && (
                  <span className="rounded-[6px] bg-(--gold-bg) px-1.5 py-px text-(--gold-fg) text-[11px]">
                    {t.maxed}
                  </span>
                )}
                {boosted && (
                  <span className="rounded-[6px] bg-(--accent-soft) px-1.5 py-px text-(--accent-text) text-[11px]">
                    {t.boosted}
                  </span>
                )}
                <span
                  className={cn(
                    "tabular min-w-11 text-right font-semibold",
                    boosted && "text-(--accent-text)",
                  )}
                >
                  {t.talentLevel(total)}
                </span>
              </span>
              <Bar value={base / MAX_TALENT} tone={maxed ? "gold" : "accent"} className="h-1" />
            </span>
          </>
        )
        return info ? (
          <HoverPreview
            key={talent}
            preview={<Description name={info.name} note={label} text={info.text} />}
            previewClassName="w-[440px] gap-1.5"
            className="items-center gap-3"
          >
            {row}
          </HoverPreview>
        ) : (
          <div key={talent} className="flex items-center gap-3">
            {row}
          </div>
        )
      })}
      {passives.length > 0 && (
        <>
          <h3 className="mt-1 text-[13px] text-muted">{t.passives}</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
            {passives.map(passive => {
              const unlocked = character.ascension >= passive.ascension
              const unlock = passive.ascension > 0 ? t.unlockAt(passive.ascension) : t.unlockDefault
              return (
                <HoverPreview
                  key={passive.name}
                  preview={
                    <Description
                      name={passive.name}
                      note={unlocked ? unlock : `${t.passiveLocked} · ${unlock}`}
                      text={passive.text}
                    />
                  }
                  previewClassName="w-[360px] gap-1.5"
                  className={cn(TILE, !unlocked && "text-muted")}
                >
                  <span aria-hidden className="contents">
                    <GameIcon
                      icon={passive.icon}
                      label={passive.name}
                      className={cn(ICON, unlocked ? "border-border" : FADED)}
                    />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[11px] text-muted">
                      {unlocked ? unlock : `${t.passiveLocked} · ${unlock}`}
                    </span>
                    <span className="text-[12px] leading-[1.4]">{passive.name}</span>
                  </span>
                </HoverPreview>
              )
            })}
          </div>
        </>
      )}
    </Panel>
  )
}
