// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { AnecdoteRow } from "@/domain/anecdotes"
import { text } from "@/text"
import { AnecdoteItem } from "./AnecdoteBody"

const t = text.anecdotePage

function row(recorded: boolean): AnecdoteRow {
  return {
    info: {
      id: 999001,
      area: 1,
      character: "FakeCharacter",
      title: "Fake anecdote",
      summary: "Fake summary",
      place: "Fake place",
    },
    status: recorded ? "recorded" : "waiting",
    recorded,
    left: recorded ? 0 : 1,
    needs: [],
  }
}

describe("the anecdote item's video guide", () => {
  it("sits in the tips box of an anecdote still to do", () => {
    const html = renderToStaticMarkup(<AnecdoteItem row={row(false)} />)
    expect(html).toContain(`aria-label="${t.videoLabel("Fake anecdote")}"`)
    expect(html).toContain(t.video)
  })

  it("is not shown once the anecdote is recorded", () => {
    const html = renderToStaticMarkup(<AnecdoteItem row={row(true)} />)
    expect(html).not.toContain(t.video)
  })

  it("searches by the anecdote's title after the guide's words", () => {
    expect(t.videoKeyword("Fake anecdote")).toBe(`${t.videoKeyword("")}Fake anecdote`)
    expect(t.videoKeyword("").trim()).not.toBe("")
  })
})
