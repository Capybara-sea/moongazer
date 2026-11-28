// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect, useMemo, useState } from "react"
import { Notice } from "@/components/Notice"
import { Segmented } from "@/components/Segmented"
import { summarizeAll } from "@/domain/wishes"
import { text } from "@/i18n"
import { formatDate } from "@/lib/format"
import { navigate, useRoute } from "@/lib/route"
import { accountName, useAccountStore, useCurrentAccount } from "@/stores/accountStore"
import { useWishStore } from "@/stores/wishStore"
import { BannersView } from "./BannersView"
import { EmptyWishes } from "./EmptyWishes"
import { HistoryView } from "./HistoryView"
import { ExportMenu, ImportButton } from "./ImportExport"
import { PoolDisplay } from "./PoolDisplay"
import { RecordsView } from "./RecordsView"

const t = text.wishes
const VIEWS = ["records", "banners", "history"] as const
type View = (typeof VIEWS)[number]

const isView = (value: string | undefined): value is View => VIEWS.some(v => v === value)

/**
 * The shown account's wish history at #/wishes/<view>: its records by pool
 * with the calculator, the past event banners, and every banner's featured
 * items. The page stays mounted while others are shown, so it keeps its own
 * view rather than reading the route of whatever page is in front.
 */
export function WishesPage() {
  const route = useRoute()
  const [view, setView] = useState<View>("records")
  const param = route.page === "wishes" ? route.param : undefined
  if (route.page === "wishes" && (isView(param) ? param : "records") !== view) {
    setView(isView(param) ? param : "records")
  }
  const { snapshot, account } = useCurrentAccount()
  const uid = snapshot?.uid ?? null
  const token = useAccountStore(s => s.shownAccount)
  const name = useAccountStore(s =>
    token === null ? undefined : accountName(s.accounts, s.names, token),
  )
  const records = useWishStore(s => s.records)
  const status = useWishStore(s => s.status)
  const storeUid = useWishStore(s => s.uid)
  const error = useWishStore(s => s.error)
  useEffect(() => {
    if (uid !== null) void useWishStore.getState().load(uid)
  }, [uid])
  const ready = status === "ready" && storeUid === uid && uid !== null
  const pools = useMemo(() => summarizeAll(ready ? records : []), [ready, records])
  const first = records[0]
  const last = records.at(-1)
  const subtitle =
    ready && first && last && name
      ? t.subtitle(name, records.length, formatDate(first.time), formatDate(last.time))
      : name
  const hasRecords = ready && records.length > 0

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="mr-auto flex flex-col">
          <h1 className="font-semibold text-[20px] leading-[1.3]">{t.title}</h1>
          {subtitle && (
            <span className="text-[12px] text-muted tabular">
              {view === "records" ? subtitle : t[view].subtitle}
            </span>
          )}
        </div>
        <Segmented
          label={t.viewLabel}
          value={view}
          options={VIEWS.map(v => ({ value: v, label: t.views[v] }))}
          onPick={v => navigate("wishes", v === "records" ? undefined : v)}
        />
        {uid !== null && view === "records" && (
          <div className="flex items-center gap-2">
            {hasRecords && <PoolDisplay pools={pools} />}
            <ImportButton uid={uid} />
            {hasRecords && <ExportMenu uid={uid} name={name ?? String(uid)} records={records} />}
          </div>
        )}
      </header>
      {snapshot === undefined && <Notice title={t.noAccount} />}
      {snapshot && uid === null && <Notice title={t.noUid} />}
      {status === "failed" && storeUid === uid && (
        <Notice title={t.loadFailed} detail={error ?? ""} />
      )}
      {view === "records" && ready && !hasRecords && uid !== null && <EmptyWishes uid={uid} />}
      {view === "records" && hasRecords && uid !== null && (
        <RecordsView
          key={uid}
          uid={uid}
          name={name ?? String(uid)}
          records={records}
          pools={pools}
          snapshot={snapshot}
          account={account}
        />
      )}
      {view === "banners" && <BannersView records={ready ? records : []} />}
      {view === "history" && <HistoryView account={account} />}
    </div>
  )
}
