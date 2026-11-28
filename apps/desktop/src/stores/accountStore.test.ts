// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Account } from "@/domain/account"
import { groupAccounts } from "@/domain/accounts"
import { lookup } from "@/domain/names"
import { text } from "@/i18n"
import { getSnapshotExport, type Snapshot } from "@/lib/backend"
import {
  type AccountEntry,
  accountName,
  entryAccount,
  knownFaces,
  knownNames,
  nextShown,
  olderThan,
  useAccountStore,
  withoutUnlisted,
} from "./accountStore"
import { useSnapshotStore } from "./snapshotStore"

vi.mock("@/lib/backend", async importOriginal => ({
  ...(await importOriginal<object>()),
  getSnapshotExport: vi.fn(async () => null),
}))

/** Made-up UIDs. */
const A = 100000001
const B = 200000002

function snapshot(id: number, hasRaw = true, uid: number | null = null): Snapshot {
  return {
    id,
    takenAt: id * 1000,
    importedAt: id * 1000,
    source: "Fake",
    uid,
    summary: {
      characters: 0,
      weapons: 0,
      artifacts: 0,
      materials: 0,
      mora: null,
      primogems: null,
      artifacts4: null,
      artifacts3: null,
      essence: null,
    },
    hasRaw,
    review: false,
    session: null,
    live: false,
  }
}

const account: Account = {
  characters: [],
  weapons: [],
  artifacts: [],
  materials: new Map(),
  characterInfo: new Map(),
}
const named = (nickname: string): AccountEntry => ({
  status: "ready",
  account: { ...account, player: { nickname } },
})

function reset() {
  useAccountStore.setState({
    account: null,
    accounts: [],
    group: null,
    names: {},
    selectedId: null,
    entries: {},
    shown: null,
    shownAccount: null,
    shownSelected: null,
  })
  useSnapshotStore.setState({ snapshots: null })
}

describe("entryAccount", () => {
  it("has no account when there is no snapshot", () => {
    expect(entryAccount(false, undefined)).toBeNull()
  })

  it("waits while the export is read", () => {
    expect(entryAccount(true, undefined)).toBeUndefined()
    expect(entryAccount(true, { status: "loading" })).toBeUndefined()
  })

  it("gives the account once read, even an empty one", () => {
    expect(entryAccount(true, { status: "ready", account })).toBe(account)
  })

  it("has no account when the export cannot be read", () => {
    expect(entryAccount(true, { status: "failed", message: "fake failure" })).toBeNull()
    expect(entryAccount(true, { status: "summaryOnly" })).toBeNull()
  })
})

describe("the Traveler's icon", () => {
  afterEach(reset)

  it("follows the twin of the account shown, once its export is read", () => {
    const icon = () => lookup("characters", "TravelerAnemo").icon
    const shown = snapshot(1)
    useAccountStore.setState({ shown, entries: { 1: { status: "loading" } } })
    expect(icon()).toBeUndefined()
    useAccountStore.setState({
      entries: { 1: { status: "ready", account: { ...account, traveler: 10000007 } } },
    })
    expect(icon()).toBe("UI_AvatarIcon_PlayerGirl")
    useAccountStore.setState({ shown: snapshot(2), entries: { 2: { status: "ready", account } } })
    expect(icon()).toBeUndefined()
  })
})

const ready: AccountEntry = { status: "ready", account }
const loading: AccountEntry = { status: "loading" }
const login = { ...snapshot(1), session: 1 }
const head = (id: number, takenAt: number) => ({ ...snapshot(id), takenAt, session: 1 })
/** A head row a newer batch replaced, and the one that replaced it. */
const replaced = head(-5, 5000)
const latest = { ...head(-6, 6000), live: true }
const list = [latest, login]

describe("nextShown", () => {
  it("keeps the head row shown while the next one is read", () => {
    expect(nextShown(latest, replaced, { 1: ready, [-5]: ready })).toBe(replaced)
    expect(nextShown(latest, replaced, { [-5]: ready, [-6]: loading })).toBe(replaced)
  })

  it("moves on once the next one is read, or failed to be", () => {
    expect(nextShown(latest, replaced, { [-5]: ready, [-6]: ready })).toBe(latest)
    const failed: AccountEntry = { status: "failed", message: "fake failure" }
    expect(nextShown(latest, replaced, { [-5]: ready, [-6]: failed })).toBe(latest)
  })

  it("shows the current one when nothing shown before can stay", () => {
    expect(nextShown(latest, null, {})).toBe(latest)
    expect(nextShown(latest, replaced, {})).toBe(latest)
    expect(nextShown(undefined, replaced, { [-5]: ready })).toBeNull()
  })

  it("shows a snapshot with only its summary at once", () => {
    const summary = snapshot(2, false)
    expect(nextShown(summary, login, { 1: ready })).toBe(summary)
  })
})

describe("olderThan", () => {
  it("gives the rows after a listed snapshot", () => {
    expect(olderThan(list, latest)).toEqual([login])
    expect(olderThan(list, login)).toEqual([])
  })

  it("places a replaced head row where it was", () => {
    expect(olderThan(list, replaced)).toEqual([login])
  })
})

describe("withoutUnlisted", () => {
  it("drops the exports of replaced head rows and deleted snapshots and keeps the rest", () => {
    const summaryOnly: AccountEntry = { status: "summaryOnly" }
    const entries = { 1: ready, 7: summaryOnly, [-5]: ready, [-6]: loading }
    const kept = withoutUnlisted(entries, list)
    expect(
      Object.keys(kept)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([-6, 1])
    expect(kept[-6]).toBe(loading)
  })

  it("gives the same entries back when nothing is dropped", () => {
    const entries = { 1: ready, [-6]: ready }
    expect(withoutUnlisted(entries, list)).toBe(entries)
  })
})

describe("knownNames and accountName", () => {
  const accounts = groupAccounts(
    [snapshot(4, true, B), snapshot(3, true, A), snapshot(2, true, B), snapshot(1, true, A)],
    [],
  )

  it("names each account from its newest export read, and by its place before one is", () => {
    const names = knownNames(accounts, { 4: loading, 2: named("FakeB"), 3: ready }, {})
    expect(names).toEqual({ 2: "FakeB" })
    expect(accountName(accounts, names, 2)).toBe("FakeB")
    expect(accountName(accounts, names, 1)).toBe(text.accounts.unnamed(1))
    expect(accountName(accounts, names, 99)).toBeUndefined()
  })

  it("keeps a name known before while the rows that gave it are gone or read again", () => {
    const before = { 1: "FakeA", 2: "FakeB" }
    expect(knownNames(accounts, { 4: loading }, before)).toBe(before)
    expect(knownNames(accounts, { 4: named("FakeRenamed") }, before)).toEqual({
      1: "FakeA",
      2: "FakeRenamed",
    })
  })

  it("keeps a name known before over an older row's while the newest is read", () => {
    const before = { 2: "FakeRenamed" }
    expect(knownNames(accounts, { 4: loading, 2: named("FakeB") }, before)).toBe(before)
    expect(knownNames(accounts, { 2: named("FakeB") }, before)).toBe(before)
    expect(knownNames(accounts, { 2: named("FakeB") }, {})).toEqual({ 2: "FakeB" })
  })

  it("takes each account's picture and frame alike, none from an export without them", () => {
    const pictured = (picture: number, frame?: number): AccountEntry => ({
      status: "ready",
      account: { ...account, player: { profilePicture: picture, profileFrame: frame } },
    })
    const faces = knownFaces(accounts, { 4: pictured(7, 8), 3: named("FakeA") }, {})
    expect(faces).toEqual({ 2: { picture: 7, frame: 8 } })
    expect(knownFaces(accounts, { 4: pictured(7, 8) }, faces)).toBe(faces)
    expect(knownFaces(accounts, { 4: pictured(9) }, faces)).toEqual({
      2: { picture: 9, frame: undefined },
    })
  })
})

describe("the account the pages show", () => {
  const a1 = snapshot(1, true, A)
  const b2 = snapshot(2, true, B)
  const a3 = snapshot(3, true, A)
  const b4 = snapshot(4, true, B)
  const two = [b4, a3, b2, a1]
  const state = () => useAccountStore.getState()

  beforeEach(() => {
    vi.stubGlobal("document", { hidden: false })
    vi.mocked(getSnapshotExport).mockImplementation(async () => ({}))
    reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(getSnapshotExport).mockImplementation(async () => null)
  })

  it("follows the newest snapshot's account, with that account's snapshots only", async () => {
    useSnapshotStore.setState({ snapshots: two })
    await vi.waitFor(() => expect(state().shown).toBe(b4))
    expect(state().accounts.map(g => g.token)).toEqual([1, 2])
    expect(state().group?.snapshots).toEqual([b4, b2])
    expect(state().shownAccount).toBe(2)
    expect(olderThan(state().group?.snapshots ?? [], b4)).toEqual([b2])
  })

  it("stays on an account chosen by hand while the other gets new rows, until a login", async () => {
    useSnapshotStore.setState({ snapshots: two })
    state().selectAccount(1)
    await vi.waitFor(() => expect(state().shown).toBe(a3))
    const live = { ...snapshot(-9, true, B), takenAt: 9000, session: 2, live: true }
    useSnapshotStore.setState({ snapshots: [live, ...two] })
    expect(state().group?.uid).toBe(A)
    expect(state().shown).toBe(a3)

    state().selectLogin(B)
    expect(state().account).toBe(2)
    await vi.waitFor(() => expect(state().shown).toBe(live))
  })

  it("follows again on a login of an account not listed yet", async () => {
    useSnapshotStore.setState({ snapshots: two })
    state().selectAccount(1)
    state().selectLogin(300000003)
    expect(state().account).toBeNull()
    expect(state().group?.uid).toBe(B)
  })

  it("keeps showing the account before until the chosen one's export is read", async () => {
    let release = () => {}
    vi.mocked(getSnapshotExport).mockImplementation(async id => {
      if (id === a3.id) {
        await new Promise<void>(resolve => {
          release = resolve
        })
      }
      return {}
    })
    useSnapshotStore.setState({ snapshots: two })
    await vi.waitFor(() => expect(state().shown).toBe(b4))

    state().selectAccount(1)
    expect(state().group?.uid).toBe(A)
    expect(state().shown).toBe(b4)
    expect(state().shownAccount).toBe(2)

    release()
    await vi.waitFor(() => expect(state().shown).toBe(a3))
    expect(state().shownAccount).toBe(1)
  })

  it("starts another account at its newest snapshot and keeps the other's exports", async () => {
    useSnapshotStore.setState({ snapshots: two })
    state().selectAccount(1)
    state().select(a1.id)
    await vi.waitFor(() => expect(state().shown).toBe(a1))
    state().selectAccount(2)
    state().selectAccount(1)
    expect(state().selectedId).toBeNull()
    await vi.waitFor(() => expect(state().shown).toBe(a3))
    expect(state().entries[b4.id]).toBeDefined()
  })

  it("follows again once the chosen account has no snapshots left", async () => {
    useSnapshotStore.setState({ snapshots: two })
    state().selectAccount(1)
    useSnapshotStore.setState({ snapshots: [b4, b2] })
    expect(state().group?.uid).toBe(B)
    expect(state().accounts).toHaveLength(1)
  })

  it("lets go of a chosen snapshot once deleted, so a later one given its id is not taken for it", async () => {
    useSnapshotStore.setState({ snapshots: two })
    state().select(b2.id)
    await vi.waitFor(() => expect(state().shown).toBe(b2))
    expect(state().shownSelected).toBe(b2.id)
    useSnapshotStore.setState({ snapshots: [b4, a3, a1] })
    expect(state().selectedId).toBeNull()
    await vi.waitFor(() => expect(state().shown).toBe(b4))
    expect(state().shownSelected).toBeNull()
    useSnapshotStore.setState({ snapshots: [{ ...b2, takenAt: 5000 }, b4, a3, a1] })
    expect(state().selectedId).toBeNull()
  })

  it("keeps the choice the shown snapshot was shown by till the next is read", async () => {
    let release = () => {}
    vi.mocked(getSnapshotExport).mockImplementation(async id => {
      if (id === b2.id) {
        await new Promise<void>(resolve => {
          release = resolve
        })
      }
      return {}
    })
    useSnapshotStore.setState({ snapshots: two })
    await vi.waitFor(() => expect(state().shown).toBe(b4))
    state().select(b2.id)
    expect(state().shown).toBe(b4)
    expect(state().shownSelected).toBeNull()
    release()
    await vi.waitFor(() => expect(state().shown).toBe(b2))
    expect(state().shownSelected).toBe(b2.id)
  })
})

describe("the chosen account across restarts", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("is kept in local storage as its token alone", async () => {
    const stored = new Map([["moongazer:accounts:selected", "2"]])
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    })
    vi.resetModules()
    const { useAccountStore: fresh } = await import("./accountStore")
    expect(fresh.getState().account).toBe(2)
    fresh.getState().selectAccount(1)
    expect(stored.get("moongazer:accounts:selected")).toBe("1")
    fresh.getState().selectAccount(null)
    expect(stored.get("moongazer:accounts:selected")).toBe("")
  })
})

describe("loadSkipped", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads the head rows a hidden window skipped that are still listed", async () => {
    vi.mocked(getSnapshotExport).mockClear()
    vi.stubGlobal("document", { hidden: true })
    reset()
    useAccountStore.setState({ selectedId: login.id })
    useSnapshotStore.setState({ snapshots: list })
    await useAccountStore.getState().load(latest.id)
    await useAccountStore.getState().load(replaced.id)
    expect(useAccountStore.getState().entries[latest.id]).toBeUndefined()

    vi.stubGlobal("document", { hidden: false })
    useAccountStore.getState().loadSkipped()
    await vi.waitFor(() =>
      expect(useAccountStore.getState().entries[latest.id]).toEqual({ status: "summaryOnly" }),
    )
    expect(getSnapshotExport).not.toHaveBeenCalledWith(replaced.id)
  })
})
