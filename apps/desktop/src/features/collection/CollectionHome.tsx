// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Armchair, BookOpen, Disc3, type LucideIcon, Trophy } from "lucide-react"
import { useMemo } from "react"
import { Bar } from "@/components/Bar"
import { achievementView } from "@/domain/achievements"
import { anecdoteView } from "@/domain/anecdotes"
import { COMPANION_PRIMOGEMS, FURNISHING_SETS, furnishingView } from "@/domain/furnishing"
import { SPINCRYSTALS, spincrystalView } from "@/domain/spincrystals"
import { formatDateTime, formatNumber } from "@/lib/format"
import { navigate } from "@/lib/route"
import { useCurrentAccount } from "@/stores/accountStore"
import { text } from "@/text"
import { AccountNotices, PARTS } from "./parts"

const t = text.collection

/** A card for each part of the collection, with how far the account is; a card opens its part. */
export function CollectionHome() {
  const { snapshot, account } = useCurrentAccount()
  const achievements = useMemo(
    () => (account?.achievements ? achievementView(account.achievements) : undefined),
    [account],
  )
  const anecdotes = useMemo(() => (account ? anecdoteView(account) : undefined), [account])
  const furnishings = useMemo(
    () =>
      account?.collections?.furnishingSets !== undefined ? furnishingView(account) : undefined,
    [account],
  )
  const crystals = useMemo(() => (account ? spincrystalView(account) : undefined), [account])
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <div className="flex flex-col">
        <h1 className="font-semibold text-[20px] leading-[1.3]">{t.title}</h1>
        {snapshot && account && (
          <span className="text-[12px] text-muted tabular">
            {[text.characters.snapshotAt(formatDateTime(snapshot.takenAt)), t.hint].join(" · ")}
          </span>
        )}
      </div>
      <AccountNotices />
      {account && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          <PartCard
            icon={Trophy}
            title={text.achievementPage.title}
            part={PARTS.achievements}
            progress={achievements && { done: achievements.done, total: achievements.total }}
            line={
              achievements &&
              t.achievementsLeft(achievements.primogems.total - achievements.primogems.earned)
            }
          />
          <PartCard
            icon={BookOpen}
            title={text.anecdotePage.title}
            part={PARTS.anecdotes}
            progress={anecdotes && { done: anecdotes.recorded, total: anecdotes.total }}
            line={
              anecdotes &&
              t.anecdotesLine(
                anecdotes.seals.earned === undefined
                  ? text.number.missing
                  : formatNumber(anecdotes.seals.earned),
                anecdotes.seals.total,
                text.anecdotePage.fastestShort(anecdotes.fastest.days),
              )
            }
          />
          <PartCard
            icon={Armchair}
            title={text.furnishingPage.title}
            part={PARTS.furnishings}
            progress={furnishings && { done: furnishings.learned, total: FURNISHING_SETS.length }}
            line={furnishings && t.furnishingLine(furnishings.claimable * COMPANION_PRIMOGEMS)}
          />
          <PartCard
            icon={Disc3}
            title={text.spincrystalPage.title}
            part={PARTS.spincrystals}
            progress={
              crystals && { done: crystals.placed + crystals.bag, total: SPINCRYSTALS.length }
            }
            line={
              crystals &&
              t.spincrystalLine(
                crystals.realmRead
                  ? formatNumber(crystals.placed)
                  : text.spincrystalPage.notPlacedRead,
                crystals.bag,
              )
            }
          />
        </div>
      )}
    </div>
  )
}

type Props = {
  icon: LucideIcon
  title: string
  part: string
  /** Missing when the snapshot has none of this part. */
  progress: { done: number; total: number } | undefined
  line: string | undefined
}

function PartCard({ icon: Icon, title, part, progress, line }: Props) {
  return (
    <button
      type="button"
      onClick={() => navigate("collection", part)}
      className="glass flex cursor-pointer flex-col gap-2.5 rounded-[14px] border border-border bg-surface px-4.5 py-4 text-left transition-colors duration-150 hover:border-(--field-border) motion-reduce:transition-none"
    >
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-[10px] bg-(--accent-soft) text-(--accent-text)"
        >
          <Icon size={18} />
        </span>
        <span className="font-semibold text-[15px]">{title} ›</span>
      </span>
      {progress ? (
        <>
          <span className="flex items-baseline justify-between tabular">
            <span>
              <b className="text-[22px]">{formatNumber(progress.done)}</b>
              <span className="text-muted"> / {formatNumber(progress.total)}</span>
            </span>
            <span className="text-[13px] text-muted">
              {t.percent(progress.done, progress.total)}
            </span>
          </span>
          <Bar value={progress.total > 0 ? progress.done / progress.total : 0} className="h-1.5" />
          {line && <span className="text-[12px] text-muted tabular">{line}</span>}
        </>
      ) : (
        <span className="text-[13px] text-muted">{text.snapshot.notRead}</span>
      )}
    </button>
  )
}
