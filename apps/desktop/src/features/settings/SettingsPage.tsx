// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { FolderOpen } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import { Panel } from "@/components/Panel"
import { Switch } from "@/components/Switch"
import { getDataDir, openDataDir, toBackendError } from "@/lib/backend"
import { cn } from "@/lib/cn"
import { type ThemeMode, useAppearanceStore } from "@/stores/appearanceStore"
import { text } from "@/text/zh"

const THEMES: { theme: ThemeMode; label: string }[] = [
  { theme: "system", label: text.theme.system },
  { theme: "light", label: text.theme.light },
  { theme: "dark", label: text.theme.dark },
]

export function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4.5 p-6">
      <h1 className="font-semibold text-[20px] leading-[1.3]">{text.settings.title}</h1>
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

type RowProps = { title: string; hint: string; children?: ReactNode }

function Row({ title, hint, children }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-6 border-(--separator) border-t py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-sm">{title}</span>
        <span className="text-[12px] text-muted">{hint}</span>
      </div>
      {children}
    </div>
  )
}

function DataPanel() {
  const [dir, setDir] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    getDataDir().then(setDir, (e: unknown) => setError(toBackendError(e).message))
  }, [])
  return (
    <Section title={text.settings.data}>
      <div className="flex items-center justify-between gap-6 border-(--separator) border-t py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-sm">{text.settings.dataDir}</span>
          {dir && <span className="select-text break-all font-mono text-[12px]">{dir}</span>}
          <span className="text-[12px] text-muted">{text.settings.dataDirHint}</span>
          {error && <span className="select-text text-[12px] text-danger">{error}</span>}
        </div>
        <Button
          variant="secondary"
          onPress={() => {
            setError(null)
            openDataDir().catch((e: unknown) =>
              setError(`${text.settings.openFailed}: ${toBackendError(e).message}`),
            )
          }}
          className="h-9 flex-none gap-1.5 rounded-[9px] border border-border bg-transparent px-3.5 font-normal text-[13px] text-foreground"
        >
          <FolderOpen aria-hidden className="m-0 size-[15px]" />
          {text.settings.openDir}
        </Button>
      </div>
      <Row title={text.settings.snapshots} hint={text.settings.snapshotsHint} />
    </Section>
  )
}

function AppearancePanel() {
  const theme = useAppearanceStore(s => s.theme)
  const glass = useAppearanceStore(s => s.glass)
  const motion = useAppearanceStore(s => s.motion)
  const store = useAppearanceStore.getState
  return (
    <Section title={text.settings.ui}>
      <div className="flex items-center justify-between gap-6 border-(--separator) border-t py-3.5">
        <span className="font-medium text-sm">{text.settings.theme}</span>
        <fieldset
          aria-label={text.settings.theme}
          className="flex flex-none gap-0.5 rounded-[9px] bg-surface-secondary p-0.5"
        >
          {THEMES.map(option => (
            <button
              key={option.theme}
              type="button"
              aria-pressed={option.theme === theme}
              onClick={e => store().setTheme(option.theme, e.currentTarget.getBoundingClientRect())}
              className={cn(
                "h-8 cursor-pointer rounded-[7px] px-3 text-[13px] transition-colors motion-reduce:transition-none",
                option.theme === theme
                  ? "bg-surface font-semibold text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
      </div>
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
    </Section>
  )
}
