// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useLayoutEffect, useRef } from "react"
import { Panel } from "@/components/Panel"
import { useUpdateStore } from "@/stores/updateStore"
import { text } from "@/text/zh"
import { APP_CHANGELOG, type ChangelogSection } from "./changelog"
import { SubpageNav } from "./subpages"

const t = text.changelog

/** Every released version's changes, newest first, from the Chinese changelog built in. */
export function ChangelogPage() {
  const root = useRef<HTMLDivElement>(null)
  // The page would otherwise open at About's scroll position.
  useLayoutEffect(() => {
    root.current?.scrollIntoView({ block: "start" })
  }, [])
  const current = useUpdateStore(s => s.info?.version)
  return (
    <div ref={root} className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <SubpageNav title={t.title} />
      {APP_CHANGELOG.map(entry => (
        <Panel key={entry.version} aria-label={entry.version}>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h2 className="tabular font-semibold text-[15px]">{entry.version}</h2>
            <span className="tabular text-[12px] text-muted">{entry.date}</span>
            {entry.version === current && (
              <span className="rounded-full bg-(--accent-soft) px-2 py-px font-medium text-(--accent-text) text-[11px]">
                {t.current}
              </span>
            )}
          </div>
          <ChangelogSections sections={entry.sections} />
        </Panel>
      ))}
    </div>
  )
}

/** A version's sections, each a title over its list of changes. */
export function ChangelogSections({ sections }: { sections: readonly ChangelogSection[] }) {
  return (
    <div className="flex select-text flex-col gap-3">
      {sections.map(section => (
        <section key={section.title} className="flex flex-col gap-1">
          <h3 className="font-semibold text-[13px]">{section.title}</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed marker:text-muted">
            {section.items.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
