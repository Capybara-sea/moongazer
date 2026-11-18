// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Panel } from "@/components/Panel"
import { useCaptureStore } from "@/stores/captureStore"
import { text } from "@/text/zh"

export function HomePage() {
  const capture = useCaptureStore(s => s.capture)
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <Panel aria-label={text.home.title} className="gap-0.5">
        <h2 className="font-semibold text-[15px]">{text.home.title}</h2>
        <p className="text-[13px] text-muted">{text.home.body}</p>
        {capture && <p className="text-[13px] text-muted">{text.home.sync}</p>}
      </Panel>
    </div>
  )
}
