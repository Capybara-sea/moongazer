// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Panel } from "@/components/Panel"
import { Switch } from "@/components/Switch"
import { useWishStore } from "@/stores/wishStore"
import { text } from "@/text"
import { ImportButton } from "./ImportExport"

const t = text.wishes

/** An account without records: reading them by itself, or a file. */
export function EmptyWishes({ uid }: { uid: number }) {
  const autoRead = useWishStore(s => s.autoRead)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <Panel>
          <h2 className="font-semibold text-[15px]">{t.empty.autoTitle}</h2>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px]">
            {t.empty.steps.map(step => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="flex items-center justify-between gap-4 border-(--separator) border-t pt-3">
            <span className="text-[13px]">{t.autoReadSwitch}</span>
            <Switch
              checked={autoRead === true}
              label={t.autoReadSwitch}
              disabled={autoRead === null}
              onChange={on => void useWishStore.getState().setAutoRead(on)}
            />
          </div>
          <p className="text-[12px] text-muted leading-[1.6]">{t.empty.autoNote}</p>
        </Panel>
        <Panel>
          <h2 className="font-semibold text-[15px]">{t.empty.importTitle}</h2>
          <p className="text-[13px] leading-[1.6]">{t.empty.importBody}</p>
          <span className="mt-auto self-start">
            <ImportButton uid={uid} primary />
          </span>
        </Panel>
      </div>
      <p className="text-[12px] text-muted">{t.empty.footnote}</p>
    </div>
  )
}
