// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import { showNotification } from "@/lib/backend"
import { isPageKey, type PageKey } from "@/lib/route"
import { readStored, writeStored } from "@/lib/storage"

/** remind: a reminder worked out from the account data; the others need the user's attention. */
export type MessageKind = "remind" | "update" | "warn" | "danger"
/** What a message's button does. */
export type MessageAction = "restart" | "download"
export type Message = {
  /** Also what keeps one from being recorded twice. */
  id: string
  /** Arrival order, from 1. */
  seq: number
  kind: MessageKind
  title: string
  body: string
  /** When it happened, unix milliseconds. */
  at: number
  /** The page it opens. */
  page: PageKey
  action?: MessageAction
}
export type NewMessage = Omit<Message, "seq">

/**
 * What is kept between runs. `seen` is the last message seen, at the latest
 * opening; `shownFrom` the one seen before it, so the ones after it are marked
 * new until the next opening. `recorded` keeps a cleared message from coming
 * back.
 */
export type Messages = {
  messages: Message[]
  lastSeq: number
  seen: number
  shownFrom: number
  recorded: string[]
}

const KEY = "moongazer:messages:state"
const NOTIFY_KEY = "moongazer:messages:notify"
const LIMIT = 100
/** Recorded ids kept; more than LIMIT, since clearing must not forget any still due. */
const REMEMBERED = 500
const KINDS: readonly string[] = ["remind", "update", "warn", "danger"] satisfies MessageKind[]
const ACTIONS: readonly string[] = ["restart", "download"] satisfies MessageAction[]

export const EMPTY: Messages = { messages: [], lastSeq: 0, seen: 0, shownFrom: 0, recorded: [] }

/** Adds a message on top, unless one with its id was recorded; the oldest go past the limit. */
export function addMessage(state: Messages, message: NewMessage, open: boolean): Messages {
  if (state.recorded.includes(message.id)) return state
  const seq = state.lastSeq + 1
  return {
    messages: [{ ...message, seq }, ...state.messages].slice(0, LIMIT),
    lastSeq: seq,
    // One that arrives while the list is open is seen at once.
    seen: open ? seq : state.seen,
    shownFrom: state.shownFrom,
    recorded: [message.id, ...state.recorded].slice(0, REMEMBERED),
  }
}

/** Opening the list sees everything; what arrived since the last opening stays marked new. */
export function openMessages(state: Messages): Messages {
  return { ...state, shownFrom: state.seen, seen: state.lastSeq }
}

export function hasUnseen(state: Messages) {
  return state.lastSeq > state.seen
}

/** The saved state, or none when it is missing or not in this shape. */
export function parseMessages(json: string | null): Messages {
  if (json === null) return EMPTY
  try {
    const value: unknown = JSON.parse(json)
    if (typeof value !== "object" || value === null) return EMPTY
    const raw = value as Record<string, unknown>
    const numbers = [raw.lastSeq, raw.seen, raw.shownFrom]
    if (!numbers.every(n => typeof n === "number") || !Array.isArray(raw.messages)) return EMPTY
    return {
      messages: raw.messages.filter(isMessage),
      lastSeq: raw.lastSeq as number,
      seen: raw.seen as number,
      shownFrom: raw.shownFrom as number,
      recorded: Array.isArray(raw.recorded)
        ? raw.recorded.filter(id => typeof id === "string")
        : [],
    }
  } catch {
    // Unreadable: start over rather than fail the app.
    return EMPTY
  }
}

function isMessage(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) return false
  const m = value as Record<string, unknown>
  return (
    typeof m.id === "string" &&
    typeof m.seq === "number" &&
    typeof m.kind === "string" &&
    KINDS.includes(m.kind) &&
    typeof m.title === "string" &&
    typeof m.body === "string" &&
    typeof m.at === "number" &&
    typeof m.page === "string" &&
    isPageKey(m.page) &&
    (m.action === undefined || (typeof m.action === "string" && ACTIONS.includes(m.action)))
  )
}

type MessageState = Messages & {
  open: boolean
  /** Goes up with each message that arrives while the list is closed: the bell rings once. */
  rings: number
  /** Whether reminders and problems also go out as Windows notifications while the app is not in front. */
  notify: boolean
  add: (message: NewMessage) => void
  setOpen: (open: boolean) => void
  clear: () => void
  setNotify: (on: boolean) => void
}

/** Updates and warnings wait for the user to come back; reminders and problems do not. */
function worthNotifying(kind: MessageKind) {
  return kind === "remind" || kind === "danger"
}

/** Minimized, hidden in the tray, or behind another window such as the game. */
function inBackground() {
  return document.visibilityState === "hidden" || !document.hasFocus()
}

function saved(state: MessageState): Messages {
  const { messages, lastSeq, seen, shownFrom, recorded } = state
  return { messages, lastSeq, seen, shownFrom, recorded }
}

/** The message center's list, kept in local storage. */
export const useMessageStore = create<MessageState>((set, get) => {
  const save = () => writeStored(KEY, JSON.stringify(saved(get())))
  return {
    ...parseMessages(readStored(KEY)),
    open: false,
    rings: 0,
    notify: readStored(NOTIFY_KEY) !== "off",

    add(message) {
      const { open, rings, notify } = get()
      const next = addMessage(saved(get()), message, open)
      if (next.lastSeq === get().lastSeq) return
      set({ ...next, rings: open ? rings : rings + 1 })
      save()
      if (notify && worthNotifying(message.kind) && inBackground()) {
        showNotification(message.title, message.body, message.page).catch(() => {
          // The message is in the list either way.
        })
      }
    },

    setOpen(open) {
      if (open === get().open) return
      set(open ? { ...openMessages(saved(get())), open } : { open })
      save()
    },

    clear() {
      set({ messages: [] })
      save()
    },

    setNotify(on) {
      set({ notify: on })
      writeStored(NOTIFY_KEY, on ? "on" : "off")
    },
  }
})
