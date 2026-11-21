// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CaptureStatus } from "@/lib/backend/sync"
import { useCaptureStore } from "./captureStore"
import { useRestartStore } from "./restartStore"

function setPhase(phase: CaptureStatus["phase"] | null) {
  const status = phase === null ? null : ({ phase } as CaptureStatus)
  useCaptureStore.setState({ status })
}

describe("restartStore", () => {
  beforeEach(() => {
    useRestartStore.setState({ pending: null })
    setPhase(null)
  })

  it("restarts at once when it need not ask and auto sync is not connected", async () => {
    setPhase("waitingLogin")
    const run = vi.fn(async () => {})
    await useRestartStore.getState().ask({ title: "t", body: [], run }, false)
    expect(run).toHaveBeenCalledOnce()
    expect(useRestartStore.getState().pending).toBeNull()
  })

  it("asks first while auto sync is connected, and restarts only on yes", async () => {
    setPhase("connected")
    const run = vi.fn(async () => {})
    await useRestartStore.getState().ask({ title: "t", body: [], run }, false)
    expect(run).not.toHaveBeenCalled()
    await useRestartStore.getState().answer(false)
    expect(run).not.toHaveBeenCalled()

    await useRestartStore.getState().ask({ title: "t", body: [], run }, false)
    await useRestartStore.getState().answer(true)
    expect(run).toHaveBeenCalledOnce()
    expect(useRestartStore.getState().pending).toBeNull()
  })

  it("always asks when told to, even without auto sync", async () => {
    const run = vi.fn(async () => {})
    await useRestartStore.getState().ask({ title: "t", body: [], run }, true)
    expect(useRestartStore.getState().pending).not.toBeNull()
    expect(run).not.toHaveBeenCalled()
  })
})
