// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it, vi } from "vitest"
import type { Messages, NewMessage } from "./messageStore"

// The route module reads the hash and listens for changes when loaded; tests run without a window.
vi.stubGlobal("location", { hash: "" })
vi.stubGlobal("addEventListener", () => {})
const { addMessage, EMPTY, hasUnseen, openMessages, parseMessages } = await import("./messageStore")

const message = (id: string): NewMessage => ({
  id,
  kind: "remind",
  title: id,
  body: "",
  at: 0,
  page: "overview",
})

const addAll = (state: Messages, ids: string[], open = false) =>
  ids.reduce((s, id) => addMessage(s, message(id), open), state)

describe("addMessage", () => {
  it("puts the newest on top and numbers arrivals", () => {
    const state = addAll(EMPTY, ["a", "b"])
    expect(state.messages.map(m => [m.id, m.seq])).toEqual([
      ["b", 2],
      ["a", 1],
    ])
  })

  it("records an id once, even after the list is cleared", () => {
    const state = addAll(EMPTY, ["a", "a"])
    expect(state.messages).toHaveLength(1)
    expect(addMessage({ ...state, messages: [] }, message("a"), false).messages).toEqual([])
  })

  it("keeps the newest 100", () => {
    const ids = Array.from({ length: 105 }, (_, i) => `m${i}`)
    const state = addAll(EMPTY, ids)
    expect(state.messages).toHaveLength(100)
    expect(state.messages[0]?.id).toBe("m104")
    expect(state.messages.at(-1)?.id).toBe("m5")
  })
})

describe("seen and new", () => {
  it("has unseen messages until the list opens", () => {
    const state = addAll(EMPTY, ["a"])
    expect(hasUnseen(state)).toBe(true)
    expect(hasUnseen(openMessages(state))).toBe(false)
  })

  it("marks as new what arrived since the opening before", () => {
    const first = openMessages(addAll(EMPTY, ["a"]))
    const second = openMessages(addAll(first, ["b", "c"]))
    expect(second.messages.filter(m => m.seq > second.shownFrom).map(m => m.id)).toEqual(["c", "b"])
  })

  it("sees at once what arrives while the list is open", () => {
    const state = addAll(openMessages(EMPTY), ["a"], true)
    expect(hasUnseen(state)).toBe(false)
  })
})

describe("parseMessages", () => {
  it("reads back what was saved", () => {
    const state = addAll(EMPTY, ["a"])
    expect(parseMessages(JSON.stringify(state))).toEqual(state)
  })

  it("starts over from nothing, broken JSON or another shape", () => {
    expect(parseMessages(null)).toEqual(EMPTY)
    expect(parseMessages("{")).toEqual(EMPTY)
    expect(parseMessages("[]")).toEqual(EMPTY)
  })

  it("drops messages it cannot show", () => {
    const state = addAll(EMPTY, ["a"])
    const broken = { ...state, messages: [...state.messages, { id: "x", page: "nowhere" }] }
    expect(parseMessages(JSON.stringify(broken)).messages.map(m => m.id)).toEqual(["a"])
  })
})
