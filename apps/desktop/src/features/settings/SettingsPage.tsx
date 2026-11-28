// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { FolderInput, FolderOpen, RotateCcw } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import { Panel } from "@/components/Panel"
import { Segmented } from "@/components/Segmented"
import { Switch } from "@/components/Switch"
import {
  type DataDir,
  getDataDir,
  moveDataDir,
  openDataDir,
  planDataDir,
  toBackendError,
} from "@/lib/backend"
import type { NumberStyle } from "@/lib/format"
import { type ThemeMode, useAppearanceStore } from "@/stores/appearanceStore"
import { useCaptureStore } from "@/stores/captureStore"
import { useMessageStore } from "@/stores/messageStore"
import { useRestartStore } from "@/stores/restartStore"
import { LANG_NAMES, type Lang, lang, text } from "@/text"

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: "system", label: text.theme.system },
  { value: "light", label: text.theme.light },
  { value: "dark", label: text.theme.dark },
]

const LANGS: { value: Lang; label: string }[] = [
  { value: "zh", label: LANG_NAMES.zh },
  { value: "en", label: LANG_NAMES.en },
]

const NUMBER_STYLES: { value: NumberStyle; label: string }[] = [
  { value: "wan", label: text.settings.numberStyles.wan },
  { value: "kmb", label: text.settings.numberStyles.kmb },
]

type SegmentsProps<T extends string> = {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  /** `from` is the picked button's bounding box. */
  onPick: (value: T, from: DOMRect) => void
  /** Under the label; the options are disabled when given. */
  disabledHint?: string
}

/** A row picking one of a few options. */
function Segments<T extends string>({
  label,
  value,
  options,
  onPick,
  disabledHint,
}: SegmentsProps<T>) {
  return (
    <div className="flex items-center justify-between gap-6 border-(--separator) border-t py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-sm">{label}</span>
        {disabledHint && <span className="text-[12px] text-muted">{disabledHint}</span>}
      </div>
      <Segmented
        label={label}
        value={value}
        options={options}
        onPick={onPick}
        disabled={disabledHint !== undefined}
      />
    </div>
  )
}

export function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4.5 p-6">
      <h1 className="font-semibold text-[20px] leading-[1.3]">{text.settings.title}</h1>
      <SyncSection />
      <NotificationsPanel />
      <DataPanel />
      <AppearancePanel />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel aria-label={title} className="gap-0 pt-4 pb-1.5">
      <h2 className="mb-1.5 font-semibold text-[15px]">{title}</h2>
      {children}
    </Panel>
  )
}

type RowProps = { title: string; hint: string; error?: string | null; children?: ReactNode }

function Row({ title, hint, error, children }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-6 border-(--separator) border-t py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-sm">{title}</span>
        <span className="text-[12px] text-muted">{hint}</span>
        {error && <span className="select-text text-[12px] text-(--err)">{error}</span>}
      </div>
      {children}
    </div>
  )
}

/** Auto sync's settings; builds without auto sync leave the section out. */
function SyncSection() {
  const capture = useCaptureStore(s => s.capture)
  const loaded = useCaptureStore(s => s.status !== null)
  const loadError = useCaptureStore(s => s.loadError)
  const autoStart = useCaptureStore(s => s.autoStart)
  const error = useCaptureStore(s => s.autoStartError)
  if (!capture) return null
  const store = useCaptureStore.getState
  return (
    <Section title={text.settings.sync}>
      <Row
        title={text.settings.autoStart}
        hint={text.settings.autoStartHint}
        error={error && `${text.settings.saveFailed}: ${error}`}
      >
        <Switch
          checked={autoStart === true}
          label={text.settings.autoStart}
          disabled={autoStart === null}
          onChange={on => void store().setAutoStart(on)}
        />
      </Row>
      <Row
        title={text.settings.status}
        hint={text.settings.statusHint}
        error={loadError && `${text.settings.syncLoadFailed}: ${loadError}`}
      >
        <Button
          variant="secondary"
          aria-label={text.settings.viewStatus}
          isDisabled={!loaded}
          onPress={() => store().setPanelOpen(true)}
          className="h-9 flex-none rounded-[9px] border border-border bg-transparent px-3.5 font-normal text-[13px] text-foreground"
        >
          {text.settings.view}
        </Button>
      </Row>
      <p className="border-(--separator) border-t pt-3 pb-2.5 text-[12px] text-muted">
        {text.settings.syncNote}
      </p>
    </Section>
  )
}

function NotificationsPanel() {
  const notify = useMessageStore(s => s.notify)
  return (
    <Section title={text.settings.notifications}>
      <Row title={text.settings.notify} hint={text.settings.notifyHint}>
        <Switch
          checked={notify}
          label={text.settings.notify}
          onChange={on => useMessageStore.getState().setNotify(on)}
        />
      </Row>
    </Section>
  )
}

const BUTTON =
  "h-9 flex-none gap-1.5 rounded-[9px] border border-border bg-transparent px-3.5 font-normal text-[13px] text-foreground"

function moveFailed(e: unknown) {
  const error = toBackendError(e)
  return `${text.settings.moveFailed}: ${text.settings.locationErrors.get(error.kind) ?? error.message}`
}

function DataPanel() {
  const [data, setData] = useState<DataDir | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    getDataDir().then(setData, (e: unknown) => setError(toBackendError(e).message))
  }, [])
  // The default folder, or one picked in a dialog; then a restart moves the data there.
  const change = async (useDefault: boolean) => {
    setError(null)
    try {
      const plan = await planDataDir(useDefault)
      if (!plan) return
      const s = text.settings
      await useRestartStore.getState().ask(
        {
          title: useDefault ? s.resetTitle : s.moveTitle,
          body: [plan.existing ? s.switchTo(plan.dir) : s.moveTo(plan.dir), s.moveNote],
          run: () => moveDataDir(plan.dir).catch((e: unknown) => setError(moveFailed(e))),
        },
        true,
      )
    } catch (e) {
      setError(moveFailed(e))
    }
  }
  return (
    <Section title={text.settings.data}>
      <div className="flex items-center justify-between gap-6 border-(--separator) border-t py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-sm">{text.settings.dataDir}</span>
          {data && <span className="select-text break-all font-mono text-[12px]">{data.dir}</span>}
          <span className="text-[12px] text-muted">{text.settings.dataDirHint}</span>
          {error && <span className="select-text text-[12px] text-(--err)">{error}</span>}
        </div>
        <div className="flex flex-none gap-2">
          {data?.movable && !data.isDefault && (
            <Button variant="secondary" onPress={() => void change(true)} className={BUTTON}>
              <RotateCcw aria-hidden className="m-0 size-[15px]" />
              {text.settings.resetDir}
            </Button>
          )}
          {data?.movable && (
            <Button variant="secondary" onPress={() => void change(false)} className={BUTTON}>
              <FolderInput aria-hidden className="m-0 size-[15px]" />
              {text.settings.changeDir}
            </Button>
          )}
          <Button
            variant="secondary"
            onPress={() => {
              setError(null)
              openDataDir().catch((e: unknown) =>
                setError(`${text.settings.openFailed}: ${toBackendError(e).message}`),
              )
            }}
            className={BUTTON}
          >
            <FolderOpen aria-hidden className="m-0 size-[15px]" />
            {text.settings.openDir}
          </Button>
        </div>
      </div>
      <Row title={text.settings.snapshots} hint={text.settings.snapshotsHint} />
    </Section>
  )
}

function AppearancePanel() {
  const theme = useAppearanceStore(s => s.theme)
  const glass = useAppearanceStore(s => s.glass)
  const motion = useAppearanceStore(s => s.motion)
  const maskUid = useAppearanceStore(s => s.maskUid)
  const numbers = useAppearanceStore(s => s.numbers)
  const store = useAppearanceStore.getState
  return (
    <Section title={text.settings.ui}>
      <Segments
        label={text.settings.language}
        value={lang}
        options={LANGS}
        onPick={picked => store().setLanguage(picked)}
      />
      <Segments
        label={text.settings.theme}
        value={theme}
        options={THEMES}
        onPick={(picked, from) => store().setTheme(picked, from)}
      />
      <Segments
        label={text.settings.numbers}
        value={numbers}
        options={NUMBER_STYLES}
        onPick={picked => store().setNumbers(picked)}
        disabledHint={lang === "en" ? text.settings.numbersEnglish : undefined}
      />
      <Row title={text.settings.glass} hint={text.settings.glassHint}>
        <Switch checked={glass} label={text.settings.glass} onChange={on => store().setGlass(on)} />
      </Row>
      <Row title={text.settings.motion} hint={text.settings.motionHint}>
        <Switch
          checked={motion}
          label={text.settings.motion}
          onChange={on => store().setMotion(on)}
        />
      </Row>
      <Row title={text.settings.maskUid} hint={text.settings.maskUidHint}>
        <Switch
          checked={maskUid}
          label={text.settings.maskUid}
          onChange={on => store().setMaskUid(on)}
        />
      </Row>
    </Section>
  )
}
