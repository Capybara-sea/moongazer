// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { Notice } from "@/components/Notice"
import { gameWeekday } from "@/domain/gameTime"
import { moveGoal, replaceCustom, replaceCustomWeapon } from "@/domain/planEdits"
import { formatDateTime } from "@/lib/format"
import { motionAllowed } from "@/lib/motion"
import { useRoute } from "@/lib/route"
import { useDragOrder } from "@/lib/useDragOrder"
import { useNow } from "@/lib/useNow"
import { usePlannerStore } from "@/stores/plannerStore"
import { text } from "@/text/zh"
import { AddGoal, type Adding } from "./AddGoal"
import { GoalCard } from "./GoalCard"
import { GoalEditor } from "./GoalEditor"
import { PlannerSettings } from "./PlannerSettings"
import { SummaryPanel, TodayPanel } from "./SidePanels"
import { UpgradePanel } from "./UpgradePanel"
import { usePlannerCards } from "./usePlannerCards"

const t = text.planner
/** How long a card jumped to keeps its outline; the fade is in index.css. */
const FLASH_MS = 1600

/**
 * #/planner/<goal id>, from the upgrade panel: once the cards are there, scrolls
 * that goal's card into view, focuses it and outlines it a moment, then drops the id from
 * the address so the same jump works again. Returns the goal outlined.
 */
function useJump(ready: boolean) {
  const route = useRoute()
  const target = route.page === "planner" ? route.param : undefined
  const [flash, setFlash] = useState<string>()
  useEffect(() => {
    if (!ready || target === undefined) return
    // Replaced, not pushed, so going back skips the jump.
    location.replace("#/planner")
    const card = [...document.querySelectorAll<HTMLElement>("[data-goal]")].find(
      el => el.dataset.goal === target,
    )
    if (!card) return
    card.scrollIntoView({ block: "center", behavior: motionAllowed() ? "smooth" : "auto" })
    card.focus({ preventScroll: true })
    setFlash(target)
  }, [ready, target])
  useEffect(() => {
    if (flash === undefined) return
    const timer = setTimeout(() => setFlash(undefined), FLASH_MS)
    return () => clearTimeout(timer)
  }, [flash])
  return flash
}

/** Goals for raising characters and weapons, against the current account's bag. */
export function PlannerPage() {
  const { snapshot, account, uid, plan, ready, failed, cards, totals } = usePlannerCards()
  const weekday = gameWeekday(useNow())
  const error = usePlannerStore(s => s.error)
  const saveError = usePlannerStore(s => s.saveError)
  const flash = useJump(ready)
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
      {failed && <Notice title={t.loadFailed} detail={error ?? ""} />}
      {saveError && <Notice title={t.saveFailed} detail={saveError} />}
      {account && ready && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[304px_1fr]">
          {/* Under the cards in a narrow window, where they would push the cards out of view. */}
          <div className="order-last flex flex-col gap-4 lg:order-first">
            {cards.length > 0 && <UpgradePanel cards={cards} />}
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
                  flash={card.goal.id === flash}
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
