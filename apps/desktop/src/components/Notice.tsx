// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Panel } from "./Panel"

/** A card that says why a page has nothing to show: no snapshots, a failed read and so on. */
export function Notice({ title, detail }: { title: string; detail?: string }) {
  return (
    <Panel aria-label={title} className="gap-0.5">
      <h2 className="font-semibold text-[15px]">{title}</h2>
      {detail && <p className="select-text text-[12px] text-muted">{detail}</p>}
    </Panel>
  )
}
