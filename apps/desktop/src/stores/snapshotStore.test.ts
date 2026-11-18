// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it, vi } from "vitest"
import { listSnapshots, type Snapshot } from "@/lib/backend"
import { useSnapshotStore, withHead } from "./snapshotStore"

vi.mock("@/lib/backend", async importOriginal => ({
  ...(await importOriginal<object>()),
  listSnapshots: vi.fn(),
}))

const row = (id: number, takenAt: number, session: number | null): Snapshot => ({
  id,
  takenAt,
  importedAt: takenAt,
  source: "Fake",
  uid: null,
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
  hasRaw: true,
  review: false,
  session,
  live: false,
})

const ids = (snapshots: Snapshot[]) => snapshots.map(s => s.id)

describe("withHead", () => {
  const login = row(3, 3000, 3)
  const oldHead = row(-2, 2500, 1)
  const oldLogin = row(1, 1000, 1)

  it("puts a session's new head row in place of its old one", () => {
    const list = [row(-4, 4000, 3), login, oldHead, oldLogin]
    expect(ids(withHead(list, row(-5, 5000, 3)))).toEqual([-5, 3, -2, 1])
  })

  it("adds a session's first head row by time, leaving other sessions' as they are", () => {
    const list = [row(9, 9000, null), login, oldHead, oldLogin]
    expect(ids(withHead(list, row(-4, 4000, 3)))).toEqual([9, -4, 3, -2, 1])
    expect(ids(withHead([login], row(-1, 1000, 1)))).toEqual([3, -1])
  })

  it("places a head row after a snapshot of the same time", () => {
    expect(ids(withHead([login], row(-4, 3000, 3)))).toEqual([3, -4])
  })
})

describe("load", () => {
  const login = row(3, 3000, 3)

  /** Reads `list` while `head` comes; what the store then lists. */
  async function readWhileHeadComes(list: Snapshot[], head: Snapshot) {
    let answer: (list: Snapshot[]) => void = () => {}
    vi.mocked(listSnapshots).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve
        }),
    )
    useSnapshotStore.setState({ snapshots: [row(-4, 4000, 3), login] })
    const read = useSnapshotStore.getState().load()
    useSnapshotStore.getState().setHead(head)
    answer(list)
    await read
    return ids(useSnapshotStore.getState().snapshots ?? [])
  }

  it("keeps a head row that came while the list was read", async () => {
    expect(await readWhileHeadComes([row(-4, 4000, 3), login], row(-5, 5000, 3))).toEqual([-5, 3])
  })

  it("drops it when the list has its session as new", async () => {
    expect(await readWhileHeadComes([row(-6, 6000, 3), login], row(-5, 5000, 3))).toEqual([-6, 3])
    expect(await readWhileHeadComes([row(7, 5000, 3), login], row(-5, 5000, 3))).toEqual([7, 3])
  })

  it("keeps the last read's list when an earlier read answers after it", async () => {
    const answers: ((list: Snapshot[]) => void)[] = []
    vi.mocked(listSnapshots).mockImplementation(() => new Promise(resolve => answers.push(resolve)))
    const first = useSnapshotStore.getState().load()
    const second = useSnapshotStore.getState().load()
    answers[1]?.([row(8, 8000, null), login])
    await second
    answers[0]?.([login])
    await first
    expect(ids(useSnapshotStore.getState().snapshots ?? [])).toEqual([8, 3])
    vi.mocked(listSnapshots).mockReset()
  })
})
