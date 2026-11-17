// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import {
  Cake,
  Compass,
  Eye,
  EyeOff,
  Heart,
  Layers,
  type LucideIcon,
  Mountain,
  Trophy,
} from "lucide-react"
import { useState } from "react"
import { GameIcon } from "@/components/GameIcon"
import { Panel } from "@/components/Panel"
import type { Account, Player } from "@/domain/account"
import { nameCardPicture, profileFrameIcon, profilePictureIcon } from "@/domain/overviewData"
import { cn } from "@/lib/cn"
import { text } from "@/text/zh"
import { accountStats, maskUid } from "./accountRows"

const CARD = "flex-row flex-wrap items-stretch gap-4 rounded-[18px] p-4"
const FADE = "transition-colors duration-300 ease-out motion-reduce:transition-none"

/** The backend's icon:// protocol, the same path GameIcon loads from. */
const iconUrl = (icon: string) => `http://icon.localhost/${icon}`

type Row = { icon: LucideIcon; label: string; value: string }

/**
 * Who the account is and its standing: avatar, name, signature and UID on
 * the left, six figures in two boxes on the right. GOOD files have none of it.
 */
export function AccountCard({ account }: { account: Account }) {
  if (!account.leyline) {
    return (
      <Panel aria-label={text.account.label} className={CARD}>
        <p className="p-1 text-[13px] text-muted">{text.account.noLeyline}</p>
      </Panel>
    )
  }
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
      <Avatar player={player} />
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
        <UidLine uid={player?.uid} onArt={onArt} />
      </div>
    </div>
  )
}

/**
 * The profile picture, in the player's frame when it has one: the frame is a
 * transparent ring drawn over the picture, which takes about 62% of its width.
 * Until the ring loads, and when no host has it, the picture keeps its border.
 */
function Avatar({ player }: { player: Player | undefined }) {
  const picture = player?.profilePicture
  const frame =
    player?.profileFrame === undefined ? undefined : profileFrameIcon(player.profileFrame)
  const [loaded, setLoaded] = useState<string>()
  const icon = picture === undefined ? undefined : profilePictureIcon(picture)
  const label = player?.nickname ?? ""
  if (frame === undefined) {
    return (
      <GameIcon
        icon={icon}
        label={label}
        className="size-20 rounded-full border-2 border-border bg-surface-secondary text-[30px]"
      />
    )
  }
  const framed = loaded === frame
  return (
    <span className="relative flex size-28 flex-none items-center justify-center">
      <GameIcon
        icon={icon}
        label={label}
        className={cn(
          "size-[70px] rounded-full border-2 bg-surface-secondary text-[26px]",
          FADE,
          framed ? "border-transparent" : "border-border",
        )}
      />
      <img
        src={iconUrl(frame)}
        alt=""
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(frame)}
        className={cn(
          "pointer-events-none absolute inset-0 size-full object-contain transition-opacity duration-300 ease-out motion-reduce:transition-none",
          !framed && "opacity-0",
        )}
      />
    </span>
  )
}

/** Masked until the eye is pressed. Not stored, so a card mounted anew starts masked. */
function UidLine({ uid, onArt }: { uid: number | undefined; onArt: boolean }) {
  const [shown, setShown] = useState(false)
  const label = shown ? text.account.hideUid : text.account.showUid
  const Icon = shown ? EyeOff : Eye
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[12px] text-muted tabular",
        FADE,
        onArt && "text-white/80",
      )}
    >
      <span>{text.account.uid}</span>
      <span key={String(shown)} data-rise>
        {uid === undefined ? text.number.missing : shown ? String(uid) : maskUid(uid)}
      </span>
      {uid !== undefined && (
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => setShown(!shown)}
          className={cn(
            "flex size-[26px] cursor-pointer items-center justify-center rounded-[6px] transition-colors hover:bg-default/60 hover:text-foreground motion-reduce:transition-none",
            onArt && "hover:bg-white/15 hover:text-white",
          )}
        >
          <Icon aria-hidden className="size-[15px]" />
        </button>
      )}
    </span>
  )
}
