// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import { EMPTY_PLAN, type Plan } from "@/domain/plan"
import { parsePlan } from "@/domain/savedPlan"
import { getPlannerData, savePlannerData, toBackendError } from "@/lib/backend"

/**
 * The plan of the account the planner shows, kept by UID in the database.
 * Every change is saved at once; a failed load leaves editing off, so a plan
 * that could not be read is never overwritten.
 */
type PlannerState = {
  uid: number | null
  plan: Plan
  status: "idle" | "loading" | "ready" | "failed"
  error: string | null
  saveError: string | null
  load: (uid: number) => Promise<void>
  change: (edit: (plan: Plan) => Plan) => void
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  uid: null,
  plan: EMPTY_PLAN,
  status: "idle",
  error: null,
  saveError: null,
  async load(uid) {
    if (get().uid === uid && get().status !== "failed") return
    set({ uid, plan: EMPTY_PLAN, status: "loading", error: null, saveError: null })
    try {
      const saved = await getPlannerData(uid)
      if (get().uid !== uid) return
      set({ plan: saved === null ? EMPTY_PLAN : parsePlan(saved), status: "ready" })
    } catch (error) {
      if (get().uid !== uid) return
      set({ status: "failed", error: toBackendError(error).message })
    }
  },
  change(edit) {
    const { uid, plan, status } = get()
    if (uid === null || status !== "ready") return
    const next = edit(plan)
    set({ plan: next })
    // One save at a time, so an older plan never lands after a newer one.
    saving = saving.then(() =>
      savePlannerData(uid, { version: 1, ...next }).then(
        () => {
          if (get().uid === uid) set({ saveError: null })
        },
        error => {
          if (get().uid === uid) set({ saveError: toBackendError(error).message })
        },
      ),
    )
  },
}))

let saving: Promise<void> = Promise.resolve()
