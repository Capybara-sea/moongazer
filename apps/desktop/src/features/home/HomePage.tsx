// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Panel } from "@/components/Panel"
import { text } from "@/text/zh"

export function HomePage() {
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 p-6">
      <Panel aria-label={text.home.title} className="gap-0.5">
        <h2 className="font-semibold text-[15px]">{text.home.title}</h2>
        <p className="text-[13px] text-muted">{text.home.body}</p>
      </Panel>
      <Panel aria-label={text.home.nextTitle}>
        <h2 className="font-semibold text-[15px]">{text.home.nextTitle}</h2>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted">
          {text.home.next.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
