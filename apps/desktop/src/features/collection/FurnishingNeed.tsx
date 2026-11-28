// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { CheckboxField } from "@/components/CheckboxField"
import { Panel } from "@/components/Panel"
import { claimNeed, type FurnishingView } from "@/domain/furnishing"
import { useRealmListStore } from "@/stores/realmListStore"
import { text } from "@/text"
import { UnitTable } from "./FurnishingDetail"

const t = text.furnishingPage

/**
 * Every furnishing the sets with rewards left need, each at the most one set needs, with what the
 * bag lacks; only the lacking ones unless asked.
 */
export function NeedList({ view }: { view: FurnishingView }) {
  const onlyShort = useRealmListStore(s => s.onlyShort)
  const query = useRealmListStore(s => s.query)
    .trim()
    .toLowerCase()
  const { setOnlyShort } = useRealmListStore.getState()
  const need = claimNeed(view)
  const filtering = view.bag && onlyShort
  const items = need.items.filter(
    item =>
      (!filtering || (item.short ?? 0) > 0) &&
      (!query || [item.info.name, ...item.sets].some(name => name.toLowerCase().includes(query))),
  )
  const empty =
    need.items.length === 0
      ? t.allClaimed
      : filtering && need.lacking === 0
        ? t.noneShort
        : t.noneFurnishings
  return (
    <Panel className="gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {view.bag && (
          <CheckboxField checked={onlyShort} label={t.onlyShort} onChange={setOnlyShort} />
        )}
        <span className="text-[12px] text-muted">{t.claimNeedNote}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-2 text-[13px] text-muted">{empty}</p>
      ) : (
        <UnitTable caption={t.views.furnishings} units={items} bag={view.bag} usedBy />
      )}
    </Panel>
  )
}
