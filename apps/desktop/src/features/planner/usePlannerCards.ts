// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useEffect, useMemo } from "react"
import { materialTotals, planCards } from "@/domain/plan"
import { plannerBag } from "@/domain/planner"
import { useCurrentAccount } from "@/stores/accountStore"
import { usePlannerStore } from "@/stores/plannerStore"

/**
 * The shown account's plan worked out against its bag: the cards in order,
 * and every card's materials added up. Loads the plan of the account shown;
 * `ready` once it is that account's. No cards till then, or without an
 * account to read. The weekday is left to the page, so it keeps one clock.
 */
export function usePlannerCards() {
  const { snapshot, account } = useCurrentAccount()
  const uid = snapshot?.uid ?? null
  const storeUid = usePlannerStore(s => s.uid)
  const status = usePlannerStore(s => s.status)
  const plan = usePlannerStore(s => s.plan)
  useEffect(() => {
    if (uid !== null) void usePlannerStore.getState().load(uid)
  }, [uid])
  const ready = status === "ready" && storeUid === uid && uid !== null
  const failed = status === "failed" && storeUid === uid
  const cards = useMemo(
    () => (account && ready ? planCards(plan, account, plannerBag(account.materials)) : []),
    [account, plan, ready],
  )
  const totals = useMemo(() => materialTotals(cards), [cards])
  return { snapshot, account, uid, plan, ready, failed, cards, totals }
}
