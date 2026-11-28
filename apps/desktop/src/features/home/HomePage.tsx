// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { RefreshCw } from "lucide-react"
import { AnimatedLogo } from "@/components/brand/AnimatedLogo"
import { Notice } from "@/components/Notice"
import { StatusDot } from "@/components/StatusDot"
import { useTip } from "@/components/Tip"
import { ImportButton } from "@/features/overview/ImportButton"
import { useSyncSide } from "@/features/sync/SyncCard"
import { useAccountStore } from "@/stores/accountStore"
import { useCaptureStore } from "@/stores/captureStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { text } from "@/text"
import { HomeBoard } from "./HomeBoard"

const t = text.home

/**
 * The page the app opens on: the game's dates and the account's newest with an account, else
 * the welcome and the first steps. Nothing until the snapshot list is read,
 * so the welcome does not flash before an account's page.
 */
export function HomePage() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  const group = useAccountStore(s => s.group)
  if (group) return <HomeBoard group={group} />
  const unread = snapshots === null && loadError === null
  // Snapshots without an account last only until it is picked.
  if (unread || (snapshots?.length ?? 0) > 0) return null
  return <Welcome />
}

function Welcome() {
  return (
    // Held near the top rather than centred, so the welcome stays put when
    // what is below it comes.
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-8 px-6 pt-[14vh] pb-6">
      <div className="flex flex-col items-center gap-5">
        <AnimatedLogo className="size-32 flex-none" />
        <h1 className="font-semibold text-2xl leading-[1.3] tracking-[0.04em]">{t.title}</h1>
        <p className="text-center text-[12px] text-muted leading-[2] tracking-[0.12em]">
          {text.about.letter.map(line => (
            <span key={line} className="letter-line block">
              {line}
            </span>
          ))}
        </p>
      </div>
      <Next />
    </div>
  )
}

function Next() {
  const snapshots = useSnapshotStore(s => s.snapshots)
  const loadError = useSnapshotStore(s => s.loadError)
  if (snapshots?.length === 0) return <FirstSteps />
  if (loadError && !snapshots) return <Notice title={text.overview.loadFailed} detail={loadError} />
  return null
}

function FirstSteps() {
  const phase = useCaptureStore(s => s.status?.phase ?? null)
  // Auto sync comes first where it can start, and stays first once it is on;
  // importing a file is the way round.
  const sync = phase !== null
  return (
    <div className="first-steps flex flex-col items-center gap-3">
      {sync && (
        <>
          {phase === "off" ? (
            <Button
              variant="primary"
              onPress={() => {
                const store = useCaptureStore.getState()
                store.setPanelOpen(true)
                void store.start()
              }}
              className="h-[38px] gap-2 rounded-[9px] px-4 font-medium text-[13px]"
            >
              <RefreshCw aria-hidden className="m-0 size-4" />
              {t.startSync}
            </Button>
          ) : (
            <SyncStage />
          )}
          <div className="flex w-56 items-center gap-3 text-[12px] text-muted">
            <span aria-hidden className="h-px flex-1 bg-(--separator)" />
            {t.or}
            <span aria-hidden className="h-px flex-1 bg-(--separator)" />
          </div>
        </>
      )}
      <ImportButton label={t.importFile} quiet={sync} />
    </div>
  )
}

/**
 * Where the start button was, once auto sync is on: its stage, and what comes
 * next or what is wrong. It opens the sync panel.
 */
function SyncStage() {
  const status = useCaptureStore(s => s.status)
  const { side } = useSyncSide(null)
  const tip = useTip<HTMLButtonElement>(t.openSync)
  if (!status || !side) return null
  const waiting =
    (status.phase === "waitingGame" || status.phase === "waitingLogin") && status.problem === null
  return (
    <button
      {...tip.props}
      type="button"
      onClick={() => useCaptureStore.getState().setPanelOpen(true)}
      className="flex max-w-full cursor-pointer flex-col items-center gap-1 rounded-[10px] px-4 py-2 transition-colors duration-150 hover:bg-default/60 motion-reduce:transition-none"
    >
      <StatusDot tone={side.tone} halo className="font-medium">
        {t.syncStage(side.label)}
      </StatusDot>
      <span className="text-[12px] text-muted">{waiting ? t.firstSnapshot : side.line}</span>
      {tip.bubble}
    </button>
  )
}
