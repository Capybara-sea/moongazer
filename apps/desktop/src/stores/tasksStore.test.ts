// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { beforeEach, describe, expect, it, vi } from "vitest"
import { EMPTY_TASKS, parseTasksDoc, type TasksDoc } from "@/domain/tasks"
import { getTasksData, saveTasksData } from "@/lib/backend"
import { useTasksStore } from "./tasksStore"

vi.mock("@/lib/backend", async importOriginal => ({
  ...(await importOriginal<object>()),
  getTasksData: vi.fn(async () => null),
  saveTasksData: vi.fn(async () => {}),
}))

/** Made-up UIDs. */
const A = 100000001
const B = 200000002

const state = () => useTasksStore.getState()

/** A doc told apart from others by identity alone, whatever fields the doc has. */
const fresh = (): TasksDoc => ({ ...EMPTY_TASKS })

beforeEach(() => {
  useTasksStore.setState({
    uid: null,
    doc: EMPTY_TASKS,
    status: "idle",
    error: null,
    saveError: null,
  })
  vi.mocked(getTasksData)
    .mockReset()
    .mockImplementation(async () => null)
  vi.mocked(saveTasksData)
    .mockReset()
    .mockImplementation(async () => {})
})

describe("tasksStore loading", () => {
  it("starts empty before the account's first save", async () => {
    await state().load(A)
    expect(getTasksData).toHaveBeenCalledWith(A)
    expect(state().uid).toBe(A)
    expect(state().status).toBe("ready")
    expect(state().doc).toEqual(EMPTY_TASKS)
  })

  it("reads the saved doc through the parser", async () => {
    const saved = JSON.stringify(EMPTY_TASKS)
    vi.mocked(getTasksData).mockImplementation(async () => saved)
    await state().load(A)
    expect(state().doc).toEqual(parseTasksDoc(saved))
  })

  it("reads an account once, and again after a failure", async () => {
    await state().load(A)
    await state().load(A)
    expect(getTasksData).toHaveBeenCalledOnce()

    vi.mocked(getTasksData).mockRejectedValueOnce(new Error("fake failure"))
    await state().load(B)
    expect(state().status).toBe("failed")
    expect(state().error).toBe("fake failure")
    await state().load(B)
    expect(state().status).toBe("ready")
    expect(state().error).toBeNull()
  })

  it("ignores a load that ends after another account was asked for", async () => {
    let fail = () => {}
    vi.mocked(getTasksData).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = () => reject(new Error("fake failure"))
        }),
    )
    const first = state().load(A)
    await state().load(B)
    fail()
    await first
    expect(state().uid).toBe(B)
    expect(state().status).toBe("ready")
    expect(state().error).toBeNull()
  })
})

describe("tasksStore changes", () => {
  it("changes nothing before an account is read, or when it could not be", async () => {
    state().change(fresh)
    expect(state().doc).toBe(EMPTY_TASKS)

    vi.mocked(getTasksData).mockRejectedValueOnce(new Error("fake failure"))
    await state().load(A)
    state().change(fresh)
    expect(state().doc).toBe(EMPTY_TASKS)
    expect(saveTasksData).not.toHaveBeenCalled()
  })

  it("saves every change in order, one at a time", async () => {
    await state().load(A)
    let release = () => {}
    vi.mocked(saveTasksData).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          release = resolve
        }),
    )
    const first = fresh()
    const second = fresh()
    state().change(() => first)
    state().change(doc => {
      expect(doc).toBe(first)
      return second
    })
    expect(state().doc).toBe(second)

    await vi.waitFor(() => expect(saveTasksData).toHaveBeenCalledOnce())
    expect(vi.mocked(saveTasksData).mock.calls[0]).toEqual([A, first])
    release()
    await vi.waitFor(() => expect(saveTasksData).toHaveBeenCalledTimes(2))
    expect(vi.mocked(saveTasksData).mock.calls[1]?.[1]).toBe(second)
  })

  it("keeps a save failure until a later save goes through", async () => {
    await state().load(A)
    vi.mocked(saveTasksData).mockRejectedValueOnce(new Error("fake failure"))
    state().change(fresh)
    await vi.waitFor(() => expect(state().saveError).toBe("fake failure"))
    state().change(fresh)
    await vi.waitFor(() => expect(state().saveError).toBeNull())
    expect(saveTasksData).toHaveBeenCalledTimes(2)
  })
})
