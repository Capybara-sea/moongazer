// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Notice } from "@/components/Notice"
import { gameWeekday } from "@/domain/gameTime"
import { materialTotals, planCards } from "@/domain/plan"
import { moveGoal, replaceCustom, replaceCustomWeapon } from "@/domain/planEdits"
import { plannerBag } from "@/domain/planner"
import { formatDateTime } from "@/lib/format"
import { useDragOrder } from "@/lib/useDragOrder"
import { useNow } from "@/lib/useNow"
import { useCurrentAccount } from "@/stores/accountStore"
import { usePlannerStore } from "@/stores/plannerStore"
import { text } from "@/text/zh"
import { AddGoal, type Adding } from "./AddGoal"
import { GoalCard } from "./GoalCard"
import { GoalEditor } from "./GoalEditor"
import { PlannerSettings } from "./PlannerSettings"
import { SummaryPanel, TodayPanel } from "./SidePanels"

const t = text.planner

/** Goals for raising characters and weapons, against the current account's bag. */
export function PlannerPage() {
  const { snapshot, account } = useCurrentAccount()
  const uid = snapshot?.uid ?? null
  const storeUid = usePlannerStore(s => s.uid)
  const status = usePlannerStore(s => s.status)
  const plan = usePlannerStore(s => s.plan)
  const error = usePlannerStore(s => s.error)
  const saveError = usePlannerStore(s => s.saveError)
  useEffect(() => {
    if (uid !== null) void usePlannerStore.getState().load(uid)
  }, [uid])
  const weekday = gameWeekday(useNow())
  const ready = status === "ready" && storeUid === uid && uid !== null
  const cards = useMemo(
    () => (account && ready ? planCards(plan, account, plannerBag(account.materials)) : []),
    [account, plan, ready],
  )
  const totals = useMemo(() => materialTotals(cards), [cards])
  const drag = useDragOrder((from, to) =>
    usePlannerStore.getState().change(p => moveGoal(p, from, to)),
  )
  const [adding, setAdding] = useState<Adding | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const when = snapshot && (snapshot.live ? t.live : formatDateTime(snapshot.takenAt))
  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex flex-1 flex-col">
          <h1 className="font-semibold text-[20px] leading-[1.3]">{t.title}</h1>
          {account && ready && when && (
            <span className="text-[12px] text-muted tabular">
              {t.subtitle(when, plan.goals.length, plan.goals.filter(goal => goal.off).length)}
            </span>
          )}
        </div>
        {account && ready && (
          <div className="flex flex-wrap items-center gap-2">
            <PlannerSettings plan={plan} />
            <Button variant="primary" onPress={() => setAdding({ kind: "character" })}>
              <Plus aria-hidden size={15} />
              {t.addCharacter}
            </Button>
            <Button variant="secondary" onPress={() => setAdding({ kind: "weapon" })}>
              <Plus aria-hidden size={15} />
              {t.addWeapon}
            </Button>
          </div>
        )}
      </header>
      {!snapshot && <Notice title={t.noAccount} detail={t.noAccountDetail} />}
      {snapshot && uid === null && <Notice title={t.noUid} detail={t.noUidDetail} />}
      {status === "failed" && storeUid === uid && (
        <Notice title={t.loadFailed} detail={error ?? ""} />
      )}
      {saveError && <Notice title={t.saveFailed} detail={saveError} />}
      {account && ready && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[304px_1fr]">
          {/* Under the cards in a narrow window, where they would push the cards out of view. */}
          <div className="order-last flex flex-col gap-4 lg:order-first">
            <TodayPanel totals={totals} weekday={weekday} />
            <SummaryPanel totals={totals} order={plan.summaryOrder} />
          </div>
          {cards.length === 0 ? (
            <Notice title={t.empty} detail={t.emptyDetail} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
              {cards.map((card, index) => (
                <GoalCard
                  key={card.goal.id}
                  card={card}
                  totals={totals}
                  weekday={weekday}
                  drag={
                    cards.length > 1
                      ? {
                          item: drag.item(index),
                          handle: drag.handle(index),
                          rearrange: drag.rearrange,
                        }
                      : undefined
                  }
                  onEdit={() => setEditing(card.goal.id)}
                  onReplace={() =>
                    setAdding({
                      kind: card.goal.kind === "customWeapon" ? "weapon" : "character",
                      replacing: card.goal.id,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
      {account && ready && (
        <AddGoal
          adding={adding}
          account={account}
          plan={plan}
          onClose={() => setAdding(null)}
          onAdd={goal => {
            setAdding(null)
            const { change } = usePlannerStore.getState()
            const replacing = adding?.replacing
            if (replacing !== undefined) {
              if (goal.kind === "character") change(p => replaceCustom(p, replacing, goal.key))
              if (goal.kind === "weapon") {
                change(p => replaceCustomWeapon(p, replacing, goal, account))
              }
              return
            }
            const id = crypto.randomUUID()
            change(p => ({ ...p, goals: [...p.goals, { ...goal, id }] }))
            setEditing(id)
          }}
        />
      )}
      <GoalEditor
        card={cards.find(card => card.goal.id === editing)}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
