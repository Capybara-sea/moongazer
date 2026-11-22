// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Account, Tasks } from "@/domain/account"
import { RESIN_CAP, realmFullNote } from "@/domain/daily"
import data from "@/generated/overview.json"
import { formatNumber } from "@/lib/format"
import { text } from "@/text/zh"
import { DailyCard } from "./DailyCard"

const t = text.daily

const account = (tasks: Tasks): Account => ({
  tasks,
  characters: [],
  weapons: [],
  artifacts: [],
  materials: new Map(),
  characterInfo: new Map(),
})

const literal = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

describe("DailyCard", () => {
  it("writes each bar's note under its value, and nowhere else", () => {
    const html = renderToStaticMarkup(
      <DailyCard
        account={account({
          resin: { value: RESIN_CAP },
          realm: { value: 2400, limit: 2400 },
          transformer: { usedAt: 0, readyAt: 1 },
        })}
        takenAt={Date.now()}
      />,
    )
    const bars: [string, string][] = [
      [`${formatNumber(RESIN_CAP)} / ${RESIN_CAP}`, t.resinFull],
      [`${formatNumber(2400)} / ${formatNumber(2400)}`, t.realmFull],
      [t.transformerReady, t.transformerReadySince],
    ]
    for (const [value, note] of bars) {
      expect(html).toMatch(
        new RegExp(`>${literal(value)}<span[^>]*>${literal(note)}</span></span>`),
      )
      expect(html.split(note)).toHaveLength(2)
    }
  })

  it("says when realm currency will be full from its Adeptal Energy, else how much fits", () => {
    const realm = (comfort?: number) =>
      renderToStaticMarkup(
        <DailyCard
          account={account({ realm: { value: 450, limit: 2400, comfort } })}
          takenAt={Date.now()}
        />,
      )
    // The rate table is regenerated with every game version, so the level is picked from it.
    const top = data.realmRates.at(-1)
    if (!top) throw new Error("the table lacks comfort levels")
    const hours = Math.ceil(1950 / top.perHour)
    expect(realm(top.comfort)).toContain(`>${realmFullNote(hours * 3_600_000)}</span>`)
    expect(realm()).toContain(`>${t.realmRoom(formatNumber(1950))}</span>`)
  })
})
