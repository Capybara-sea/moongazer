// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Cake, Compass, Heart, Layers, type LucideIcon, Mountain, Trophy } from "lucide-react"
import { useState } from "react"
import { Panel } from "@/components/Panel"
import { ProfileAvatar } from "@/components/ProfileAvatar"
import { UidLine } from "@/components/UidLine"
import type { Account, Player } from "@/domain/account"
import { nameCardPicture } from "@/domain/overviewData"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { useAppearanceStore } from "@/stores/appearanceStore"
import { accountStats } from "./accountRows"

const CARD = "flex-row flex-wrap items-stretch gap-4 rounded-[18px] p-4"
const FADE = "transition-colors duration-300 ease-out motion-reduce:transition-none"

/** The backend's icon:// protocol, the same path GameIcon loads from. */
const iconUrl = (icon: string) => `http://icon.localhost/${icon}`

type Row = { icon: LucideIcon; label: string; value: string }

/**
 * Who the account is and its standing: avatar, name, signature and UID on
 * the left, six figures in two boxes on the right.
 */
export function AccountCard({ account }: { account: Account }) {
  const stats = accountStats(account)
  const columns: Row[][] = [
    [
      { icon: Compass, label: text.account.ar, value: stats.ar },
      { icon: Mountain, label: text.account.wl, value: stats.wl },
      { icon: Trophy, label: text.account.achievements, value: stats.achievements },
    ],
    [
      { icon: Heart, label: text.account.maxFriendship, value: stats.maxFriendship },
      { icon: Layers, label: text.account.abyss, value: stats.abyss },
      { icon: Cake, label: text.account.birthday, value: stats.birthday },
    ],
  ]
  return (
    <Panel aria-label={text.account.label} className={CARD}>
      <Identity player={account.player} />
      <div className="grid min-w-0 flex-[2_1_520px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {columns.map(rows => (
          <dl
            key={rows[0]?.label}
            className="glass-inset flex flex-col justify-center gap-0.5 rounded-[12px] bg-surface-secondary px-3.5 py-2"
          >
            {rows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex h-[34px] items-center gap-2.5 text-[13px]">
                <dt className="flex min-w-0 flex-1 items-center gap-2.5 text-muted">
                  <Icon aria-hidden className="size-4 flex-none" />
                  <span className="truncate">{label}</span>
                </dt>
                <dd key={value} data-rise className="font-semibold tabular">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </Panel>
  )
}

/**
 * Avatar, name, signature and UID, on the player's name card art when there
 * is one. The art fades in once loaded and only then does the text turn white,
 * so the text stays readable while it loads. When no host has it, the block
 * takes the look it has without a name card.
 */
function Identity({ player }: { player: Player | undefined }) {
  const card = player?.nameCard === undefined ? undefined : nameCardPicture(player.nameCard)
  const [loaded, setLoaded] = useState<string>()
  const [failed, setFailed] = useState<string>()
  const art = card === failed ? undefined : card
  const onArt = art !== undefined && loaded === art
  const maskUid = useAppearanceStore(s => s.maskUid)
  return (
    <div
      className={cn(
        "flex min-w-0 flex-[1_1_340px] items-center",
        art === undefined
          ? "gap-4 p-1"
          : "isolate relative min-h-[132px] gap-3.5 overflow-hidden rounded-[14px] py-2.5 pr-4 pl-2",
      )}
    >
      {art !== undefined && (
        <div
          className={cn(
            "absolute inset-0 -z-10 transition-opacity duration-300 ease-out motion-reduce:transition-none",
            !onArt && "opacity-0",
          )}
        >
          <img
            src={iconUrl(art)}
            alt=""
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(art)}
            onError={() => setFailed(art)}
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-(image:--name-card-shade)" />
        </div>
      )}
      <ProfileAvatar
        picture={player?.profilePicture}
        frame={player?.profileFrame}
        label={player?.nickname ?? ""}
        size="large"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <h2
          className={cn(
            "truncate font-semibold text-[22px] leading-[1.3] transition-[color,text-shadow] duration-300 ease-out motion-reduce:transition-none",
            onArt && "text-white [text-shadow:var(--name-card-text-shadow)]",
          )}
        >
          {player?.nickname ?? text.number.missing}
        </h2>
        {player?.signature && (
          <span
            className={cn("break-words text-[13px] text-muted", FADE, onArt && "text-white/80")}
          >
            {player.signature}
          </span>
        )}
        <UidLine
          // A new default masks or shows the UID again.
          key={String(maskUid)}
          uid={player?.uid}
          masked={maskUid}
          className={cn("text-[12px] text-muted", FADE, onArt && "text-white/80")}
          buttonClassName={cn("size-[26px]", onArt && "hover:bg-white/15 hover:text-white")}
        />
      </div>
    </div>
  )
}
