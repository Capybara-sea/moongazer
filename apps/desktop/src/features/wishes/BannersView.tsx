// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useMemo, useState } from "react"
import { FilterChip } from "@/components/FilterChip"
import { GameIcon } from "@/components/GameIcon"
import { iconTone } from "@/components/RarityChip"
import { Tip } from "@/components/Tip"
import { serverMonthDay } from "@/domain/gameTime"
import { type BannerPulls, bannerPulls, poolOf, type WishRecord } from "@/domain/wishes"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { formatNumber } from "@/lib/format"
import { itemView, TAG_TONES } from "./items"

const t = text.wishes.banners
const FILTERS = ["all", "character", "weapon", "chronicled"] as const
type Filter = (typeof FILTERS)[number]
/** A half's banners in this order. */
const TYPE_ORDER = [301, 400, 302, 500]
/** Versions shown before "show earlier versions". */
const FIRST_VERSIONS = 3

type Version = { version: string; banners: BannerPulls[] }

/** The event banners by version, newest first: what was featured, and how each went for the account. */
export function BannersView({ records }: { records: readonly WishRecord[] }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [only, setOnly] = useState(false)
  const [all, setAll] = useState(false)
  const versions = useMemo(() => {
    const list: Version[] = []
    for (const banner of bannerPulls(records)) {
      const last = list.at(-1)
      if (last?.version === banner.banner.version) last.banners.push(banner)
      else list.push({ version: banner.banner.version, banners: [banner] })
    }
    return list
  }, [records])
  const shown = all ? versions : versions.slice(0, FIRST_VERSIONS)
  const keep = (b: BannerPulls) =>
    (filter === "all" || poolOf(b.banner.type) === filter) && (!only || b.pulls > 0)
  const visible = shown.filter(v => v.banners.some(keep))
  const earlier = versions.slice(FIRST_VERSIONS)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => (
          <FilterChip
            key={f}
            pressed={filter === f}
            onPress={() => setFilter(f)}
            className="h-[30px]"
          >
            {t.filters[f]}
          </FilterChip>
        ))}
        <span className="flex-1" />
        <FilterChip pressed={only} onPress={() => setOnly(!only)} className="h-[30px]">
          {t.onlyPulled}
        </FilterChip>
      </div>
      {visible.map(v => (
        <VersionBlock key={v.version} version={v} keep={keep} />
      ))}
      {visible.length === 0 && (
        <p className="rounded-[14px] border border-border border-dashed p-8 text-center text-[13px] text-muted">
          {t.empty}
        </p>
      )}
      {!all && earlier.length > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="h-9 cursor-pointer self-center rounded-[9px] border border-border px-[18px] text-[13px] hover:bg-default/60"
        >
          {t.more(earlier[0]?.version ?? "", earlier.at(-1)?.version ?? "")}
        </button>
      )}
    </div>
  )
}

function VersionBlock({ version, keep }: { version: Version; keep: (b: BannerPulls) => boolean }) {
  const pulls = version.banners.reduce((sum, b) => sum + b.pulls, 0)
  const fives = version.banners.reduce((sum, b) => sum + b.fives.length, 0)
  const ups = version.banners.reduce(
    (sum, b) => sum + b.fives.filter(f => b.banner.up5.includes(f.itemId)).length,
    0,
  )
  // Halves by their start, newest first; 1.3 had a third run, shown as a second half.
  const halves: BannerPulls[][] = []
  for (const banner of version.banners.filter(keep)) {
    const half = halves.find(h => h[0]?.banner.phase === banner.banner.phase)
    if (half) half.push(banner)
    else halves.push([banner])
  }
  for (const half of halves) {
    half.sort((a, b) => TYPE_ORDER.indexOf(a.banner.type) - TYPE_ORDER.indexOf(b.banner.type))
  }
  return (
    <section aria-label={t.version(version.version)} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1 border-(--separator) border-b pb-1.5">
        <b className="font-semibold text-[26px] leading-[1.1] tabular">{version.version}</b>
        <span className="text-[13px] text-muted tabular">{t.sum(pulls, fives, ups)}</span>
      </div>
      {halves.map(half => {
        const first = half[0]?.banner
        if (!first) return null
        return (
          <div key={first.phase} className="flex flex-col gap-2.5">
            <span className="text-[12px] text-muted tabular">
              {t.phase(first.phase >= 2, serverMonthDay(first.from), serverMonthDay(first.to))}
            </span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
              {half.map(b => (
                <BannerCard key={`${b.banner.type}-${b.banner.from}`} pulls={b} />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function BannerCard({ pulls: b }: { pulls: BannerPulls }) {
  const pool = poolOf(b.banner.type)
  const result = b.gotUp ? "got" : b.pulls > 0 ? "missed" : "none"
  return (
    <article
      aria-label={b.banner.name}
      className={cn(
        "glass flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-3.5 transition-opacity",
        b.pulls === 0 && "opacity-55",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-muted">{pool ? text.wishes.pools[pool] : ""}</span>
        <span
          className={cn(
            "ml-auto rounded-full px-2 text-[11px] leading-5",
            result === "got"
              ? "bg-[color-mix(in_srgb,var(--ok)_18%,transparent)] text-(--ok)"
              : result === "missed"
                ? "text-muted shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-muted",
          )}
        >
          {t.result[result]}
        </span>
      </div>
      <b className="-mt-1.5 font-semibold text-[16px]">{b.banner.name}</b>
      <div className="flex flex-wrap items-end gap-2">
        {b.banner.up5.map(id => {
          const { name, icon } = itemView(id)
          return (
            <Tip key={id} content={t.up5(name)} className="contents">
              <GameIcon
                icon={icon}
                label={name}
                className={cn("size-[52px] rounded-[12px]", iconTone(5))}
              />
            </Tip>
          )
        })}
        <span aria-hidden className="mx-0.5 h-7 w-px bg-(--separator)" />
        {b.banner.up4.map(id => {
          const { name, icon } = itemView(id)
          return (
            <Tip key={id} content={t.up4(name)} className="contents">
              <GameIcon
                icon={icon}
                label={name}
                className={cn("size-[30px] rounded-[7px] text-[11px]", iconTone(4))}
              />
            </Tip>
          )
        })}
      </div>
      <div className="flex min-h-[52px] items-center gap-3 rounded-[10px] bg-surface-secondary px-3 py-2">
        <span className="flex min-w-14 flex-col">
          <span className="font-semibold text-[20px] leading-[1.2] tabular">
            {formatNumber(b.pulls)}
            <span className="font-normal text-[12px] text-muted"> {text.wishes.row.pulls}</span>
          </span>
          <span className="text-[11px] text-muted tabular">{t.fours(b.fours)}</span>
        </span>
        <span className="flex flex-1 flex-wrap justify-end gap-2.5">
          {b.fives.map(pull => {
            const { name, icon } = itemView(pull.itemId, pull.name)
            const tag = pull.tag ? text.wishes.tags[pull.tag] : ""
            return (
              <Tip
                key={pull.id}
                content={t.gotTip(name, pull.pity, tag)}
                className="flex items-center gap-1.5"
              >
                <GameIcon
                  icon={icon}
                  label={name}
                  className={cn("size-[34px] rounded-[8px]", iconTone(5))}
                />
                <span className="flex flex-col items-start leading-[1.25]">
                  <span className="text-[12px] tabular">
                    {name} · {pull.pity}
                  </span>
                  {pull.tag && (
                    <span
                      className={cn(
                        "rounded-[4px] px-[5px] text-[10px] leading-[15px]",
                        TAG_TONES[pull.tag],
                      )}
                    >
                      {tag}
                    </span>
                  )}
                </span>
              </Tip>
            )
          })}
          {b.fives.length === 0 && (
            <span className="text-[12px] text-muted">
              {b.pulls === 0 ? t.notPulled : b.carried > 0 ? t.carried(b.carried) : t.noFive}
            </span>
          )}
        </span>
      </div>
    </article>
  )
}
