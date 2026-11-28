// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { LabeledText } from "@/components/Delta"
import { Panel } from "@/components/Panel"
import type { Labeled } from "@/lib/format"
import { text } from "@/text"

const t = text.characterDetail

/** The changes since the previous snapshot; null when there is none to compare with. */
export function ChangesCard({ changes }: { changes: Labeled[] | null }) {
  return (
    <Panel aria-label={t.changes} className="gap-2.5 px-4.5 py-4">
      <h2 className="font-semibold text-[15px]">{t.changes}</h2>
      {changes && changes.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {changes.map(line => (
            <li key={line.label} className="flex items-center gap-2">
              <span aria-hidden className="size-1.5 flex-none rounded-full bg-accent" />
              <span className="tabular">
                <LabeledText item={line} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-muted">{changes ? t.noChanges : t.noPrevious}</span>
      )}
    </Panel>
  )
}
