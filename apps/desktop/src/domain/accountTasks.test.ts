// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { describe, expect, it } from "vitest"
import { parseAccount } from "./account"

/** Parses a Leyline export with only the given `gi_*` parts. Every value is made up. */
const leyline = (parts: Record<string, unknown>) =>
  parseAccount({ format: "GOOD", version: 3, leyline: 1, ...parts })

describe("parseAccount on the task board's parts", () => {
  it("reads the weekly boss discounts left", () => {
    const { tasks } = leyline({
      gi_tasks: { weeklyBosses: { left: 1, used: 2, limit: 3, cost: 30, fullCost: 60 } },
    })
    expect(tasks?.weeklyBosses).toEqual({ left: 1, limit: 3 })
  })

  it("reads the Epitomized Path, its weapon and points", () => {
    const { tasks } = leyline({
      gi_tasks: { wishPath: { weapon: "FakeBow", points: 1, max: 1 } },
    })
    expect(tasks?.wishPath).toEqual({ weapon: "FakeBow", points: 1 })
    expect(leyline({ gi_tasks: { wishPath: { points: 1 } } }).tasks?.wishPath).toBeUndefined()
  })

  it("reads an old export's discounts, which gave the count used as left", () => {
    const { tasks } = leyline({ gi_tasks: { weeklyBosses: { left: 1, limit: 3 } } })
    expect(tasks?.weeklyBosses).toEqual({ left: 2, limit: 3 })
    const over = leyline({ gi_tasks: { weeklyBosses: { left: 5, limit: 3 } } })
    expect(over.tasks?.weeklyBosses?.left).toBe(0)
  })

  it("reads the claimed rank rewards and Paimon's Bargains with its time", () => {
    const { tasks } = leyline({
      gi_tasks: {
        arRewards: [2, 3, "4", 5],
        bargains: {
          at: 1_000,
          bought: true,
          fates: [
            { item: "FakeFate", currency: "FakeDust", cost: 75, bought: 2, limit: 5 },
            { item: "FakeFate", currency: "FakeGlitter", cost: 5 },
            { currency: "FakeDust", bought: 1, limit: 5 },
          ],
        },
      },
    })
    expect(tasks?.arRewards).toEqual([2, 3, 5])
    expect(tasks?.bargains).toEqual({
      at: 1_000_000,
      fates: [
        { item: "FakeFate", currency: "FakeDust", bought: 2, limit: 5 },
        { item: "FakeFate", currency: "FakeGlitter", bought: 0, limit: undefined },
      ],
    })
  })

  it("tells an empty expedition list from a missing one", () => {
    expect(leyline({ gi_tasks: { expeditions: [] } }).tasks?.expeditions).toEqual([])
    expect(leyline({ gi_tasks: {} }).tasks?.expeditions).toBeUndefined()
  })

  it("reads the events with their times and reward tiers", () => {
    const { events } = leyline({
      gi_events: {
        5001: {
          schedule: 5001001,
          start: 1_000,
          end: 2_000,
          progress: {
            1: { progress: 3, total: 5, claimed: false },
            2: { total: 1, claimed: true },
          },
        },
        5002: { schedule: 5002001, start: 1_000, end: 3_000 },
      },
    })
    expect(events).toEqual([
      {
        id: 5001,
        start: 1_000_000,
        end: 2_000_000,
        counters: [
          { progress: 3, total: 5, claimed: false },
          { progress: 0, total: 1, claimed: true },
        ],
      },
      { id: 5002, start: 1_000_000, end: 3_000_000, counters: undefined },
    ])
    expect(leyline({}).events).toBeUndefined()
  })

  it("reads malformed task and event fields as missing", () => {
    const account = leyline({
      gi_tasks: { arRewards: { 2: true }, bargains: { fates: [] } },
      gi_events: {
        x: { start: 1, end: 2 },
        5001: { start: "1", end: 2 },
        5002: { start: 1 },
        5003: "running",
        5004: { start: 1, end: 2, progress: { 1: null, 2: { total: 2, claimed: "yes" } } },
      },
    })
    expect(account.tasks?.arRewards).toBeUndefined()
    expect(account.tasks?.bargains).toBeUndefined()
    expect(account.events).toEqual([
      { id: 5004, start: 1_000, end: 2_000, counters: [{ progress: 0, total: 2, claimed: false }] },
    ])
    expect(leyline({ gi_events: [] }).events).toBeUndefined()
  })
})
