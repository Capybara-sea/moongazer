// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Alert } from "@heroui/react"
import { AnimatedLogo } from "@/components/brand/AnimatedLogo"
import { Panel } from "@/components/Panel"
import { useUpdateStore } from "@/stores/updateStore"
import { text } from "@/text/zh"
import { UpdateCard } from "./UpdateCard"

export function AboutPage() {
  const info = useUpdateStore(s => s.info)
  const loadError = useUpdateStore(s => s.loadError)

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      {loadError && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{text.update.loadFailed}</Alert.Title>
            <Alert.Description>{loadError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <Panel
        aria-label={text.appName}
        className="flex-row flex-wrap items-center gap-6 rounded-[18px] px-6 py-5.5"
      >
        <AnimatedLogo className="size-32 flex-none" />
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-semibold text-2xl leading-[1.3] tracking-[0.04em]">
              {text.appName}{" "}
              <span className="font-normal text-muted text-sm tracking-normal">
                {text.appNameLatin}
              </span>
            </h1>
            <span className="text-[13px] text-muted">{text.about.tagline}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13px]">
            <dt className="text-muted">{text.about.version}</dt>
            <dd className="tabular">{info?.version ?? "-"}</dd>
            <dt className="text-muted">{text.about.mode}</dt>
            <dd>{info ? (info.portable ? text.about.portable : text.about.installed) : "-"}</dd>
            <dt className="text-muted">{text.about.license}</dt>
            <dd>MIT</dd>
          </dl>
          <p className="glass-inset rounded-[10px] bg-surface-secondary px-3 py-2 text-[12px] text-muted">
            {text.about.disclaimer}
          </p>
        </div>
      </Panel>
      <UpdateCard />
    </div>
  )
}
