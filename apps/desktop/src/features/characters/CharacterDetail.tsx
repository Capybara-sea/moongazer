// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Notice } from "@/components/Notice"
import type { Account } from "@/domain/account"
import { wielderKey } from "@/domain/builds"
import type { Character } from "@/domain/good"
import { characterData } from "@/domain/names"
import { useCurrentAccount, usePreviousAccount } from "@/stores/accountStore"
import { useCaptureStore } from "@/stores/captureStore"
import { useCharacterListStore } from "@/stores/characterListStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text/zh"
import { ArtifactsCard } from "./ArtifactsCard"
import { ChangesCard } from "./ChangesCard"
import { CharacterRail } from "./CharacterRail"
import { characterChanges } from "./changes"
import { DetailHeader } from "./DetailHeader"
import { comparedAccount, detailOrder, neighbors } from "./detail"
import { InfoCard } from "./InfoCard"
import { StatsCard } from "./StatsCard"
import { ConstellationCard, TalentsCard } from "./TalentCards"
import { WeaponCard } from "./WeaponCard"

/**
 * One character's details, as in the design: the way back and the previous
 * and next buttons on top; below, the list as a column of avatars beside the
 * character's cards. Blocks are direct children of the page's root so they
 * rise in one after another.
 */
export function CharacterDetail({ characterKey }: { characterKey: string }) {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  const capture = useCaptureStore(s => s.capture)
  const { snapshot, entry, account } = useCurrentAccount()
  const compared = comparedAccount(usePreviousAccount())

  const character = account?.characters.find(c => c.key === characterKey)
  let notice: { title: string; detail?: string } | undefined
  if (loadError && !snapshots) {
    notice = { title: text.overview.loadFailed, detail: loadError }
  } else if (snapshots?.length === 0) {
    notice = { title: text.overview.emptyTitle, detail: text.overview.emptyBody(capture) }
  } else if (snapshot && (!snapshot.hasRaw || entry?.status === "summaryOnly")) {
    notice = { title: text.snapshot.summaryOnly }
  } else if (entry?.status === "failed") {
    notice = { title: text.snapshot.loadFailed, detail: entry.message }
  } else if (account && !character) {
    notice = { title: text.characterDetail.notFound(characterKey) }
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      {account && character ? (
        <Detail account={account} character={character} previous={compared} />
      ) : (
        <>
          <DetailHeader />
          {notice && <Notice title={notice.title} detail={notice.detail} />}
        </>
      )}
    </div>
  )
}

type Props = {
  account: Account
  character: Character
  /** The account to compare with; undefined while it is read, null when there is none. */
  previous: Account | null | undefined
}

function Detail({ account, character, previous }: Props) {
  const element = useCharacterListStore(s => s.element)
  const query = useCharacterListStore(s => s.query)
  const sort = useCharacterListStore(s => s.sort)
  const { key } = character
  const order = detailOrder(account.characters, { element, query, sort }, key)
  const wielder = wielderKey(key)
  const weapon = account.weapons.find(w => w.location === wielder)
  const artifacts = account.artifacts.filter(a => a.location === wielder)
  const changes = previous && characterChanges(account, previous, key)

  return (
    <>
      <DetailHeader
        name={characterData(key).name}
        order={neighbors(
          order.map(c => c.key),
          key,
        )}
      />
      <div className="flex flex-wrap items-start gap-4">
        <CharacterRail characters={order} selected={key} />
        {/* Keyed, so each character's cards are new and rise in through the
            page's entrance styles. Those move the glass panels themselves:
            opacity on an ancestor would cut them off from the glow behind. */}
        <div key={key} className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <InfoCard character={character} info={account.characterInfo.get(key)} />
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
              <ConstellationCard character={character} />
              <TalentsCard character={character} />
              <WeaponCard weapon={weapon} />
            </div>
            <div className="flex min-w-0 flex-[1.5_1_480px] flex-col gap-4">
              <StatsCard character={character} weapon={weapon} artifacts={artifacts} />
              <ArtifactsCard artifacts={artifacts} />
              {changes !== undefined && <ChangesCard changes={changes} />}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
