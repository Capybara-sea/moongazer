// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { LayoutGrid, List, type LucideIcon } from "lucide-react"
import { useMemo } from "react"
import { EmptyState } from "@/components/EmptyState"
import { FilterChip } from "@/components/FilterChip"
import { GameIcon } from "@/components/GameIcon"
import { LabeledSelect } from "@/components/LabeledSelect"
import { Notice } from "@/components/Notice"
import { SearchBox } from "@/components/SearchBox"
import { ShownCount } from "@/components/ShownCount"
import { ViewToggle } from "@/components/ViewToggle"
import type { Account } from "@/domain/account"
import { ELEMENT_ICONS, ELEMENTS } from "@/domain/elements"
import { characterData } from "@/domain/names"
import { useEmptyBody } from "@/features/overview/emptyBody"
import { formatDateTime, formatNumber } from "@/lib/format"
import { useCurrentAccount } from "@/stores/accountStore"
import {
  type CharacterSort,
  type CharacterView,
  useCharacterListStore,
} from "@/stores/characterListStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"
import { CharacterCard } from "./CharacterCard"
import { CharacterTable } from "./CharacterTable"
import { cardInfos } from "./cardInfo"
import { ELEMENT_TINT } from "./elementStyles"
import { visibleCharacters } from "./order"

const t = text.characters
const SORTS: readonly CharacterSort[] = ["level", "rarity", "constellation"]
const VIEWS: readonly { value: CharacterView; label: string; icon: LucideIcon }[] = [
  { value: "cards", label: text.views.cards, icon: LayoutGrid },
  { value: "list", label: text.views.list, icon: List },
]

/**
 * The character list: header, element filter, search, sort and view, then a
 * card or row per character. Blocks are direct children of the page's root so
 * they rise in one after another.
 */
export function CharacterList() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  const emptyBody = useEmptyBody()
  const { snapshot, entry, account } = useCurrentAccount()
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col">
        <h1 className="font-semibold text-[20px] leading-[1.3]">{t.title}</h1>
        {account && snapshot && (
          <span className="text-[12px] text-muted tabular">
            {subtitle(account, snapshot.takenAt)}
          </span>
        )}
      </div>
      {loadError && !snapshots && <Notice title={text.overview.loadFailed} detail={loadError} />}
      {snapshots?.length === 0 && <Notice title={text.overview.emptyTitle} detail={emptyBody} />}
      {snapshot && (!snapshot.hasRaw || entry?.status === "summaryOnly") && (
        <Notice title={text.snapshot.summaryOnly} />
      )}
      {entry?.status === "failed" && (
        <Notice title={text.snapshot.loadFailed} detail={entry.message} />
      )}
      {account &&
        (account.characters.length === 0 ? (
          <EmptyState>{t.empty}</EmptyState>
        ) : (
          <Characters account={account} />
        ))}
    </div>
  )
}

function subtitle(account: Account, takenAt: number) {
  const rarities = account.characters.map(character => characterData(character.key).rarity)
  const count = (rarity: number) => rarities.filter(r => r === rarity).length
  return [
    t.summary(formatNumber(rarities.length), formatNumber(count(5)), formatNumber(count(4))),
    t.snapshotAt(formatDateTime(takenAt)),
    t.openHint,
  ].join(" · ")
}

/** The toolbar and the cards or rows, or a note when the filters leave none. */
function Characters({ account }: { account: Account }) {
  const element = useCharacterListStore(s => s.element)
  const query = useCharacterListStore(s => s.query)
  const sort = useCharacterListStore(s => s.sort)
  const view = useCharacterListStore(s => s.view)
  const infos = useMemo(() => cardInfos(account), [account])
  const shown = useMemo(
    () => visibleCharacters(account.characters, { element, query, sort }),
    [account, element, query, sort],
  )
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ElementFilter />
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox
            value={query}
            label={t.search}
            onChange={useCharacterListStore.getState().setQuery}
          />
          <LabeledSelect
            label={t.sort}
            value={sort}
            options={SORTS.map(option => ({ value: option, label: t.sorts[option] }))}
            onChange={value => {
              const picked = SORTS.find(option => option === value)
              if (picked) useCharacterListStore.getState().setSort(picked)
            }}
          />
          <ViewToggle
            label={text.views.label}
            value={view}
            options={VIEWS}
            onChange={useCharacterListStore.getState().setView}
          />
          <ShownCount shown={shown.length} total={account.characters.length} format={t.shown} />
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState>{t.none}</EmptyState>
      ) : view === "list" ? (
        <CharacterTable characters={shown} infos={infos} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {shown.map(character => {
            const info = infos.get(character.key)
            return info && <CharacterCard key={character.key} character={character} info={info} />
          })}
        </div>
      )}
    </>
  )
}

function ElementFilter() {
  const element = useCharacterListStore(s => s.element)
  const { setElement } = useCharacterListStore.getState()
  return (
    <fieldset aria-label={t.byElement} className="flex flex-wrap gap-1.5">
      <FilterChip pressed={element === null} onPress={() => setElement(null)}>
        {t.all}
      </FilterChip>
      {ELEMENTS.map(option => {
        const name = text.game.elementLong(text.game.elements[option])
        return (
          // Icons only; the name is the label read out and shown on hover.
          <FilterChip
            key={option}
            pressed={element === option}
            onPress={() => setElement(option)}
            selected={ELEMENT_TINT[option]}
            label={name}
            className="w-[34px] justify-center px-0"
          >
            <span aria-hidden>
              <GameIcon
                icon={ELEMENT_ICONS[option]}
                label={name}
                className="size-[18px] text-[10px]"
              />
            </span>
          </FilterChip>
        )
      })}
    </fieldset>
  )
}
