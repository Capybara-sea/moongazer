// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { useMemo, useState } from "react"
import { CheckboxField } from "@/components/CheckboxField"
import { SearchBox } from "@/components/SearchBox"
import type { Account } from "@/domain/account"
import type { Plan } from "@/domain/plan"
import { text } from "@/text/zh"
import {
  characterOptions,
  customGoal,
  type Filters,
  type NewGoal,
  NO_FILTERS,
  shownOptions,
  weaponOptions,
  withExpBoost,
} from "./addOptions"
import { GoalPicker } from "./GoalPicker"

const t = text.planner

/** A new goal of a kind, or, with `replacing`, the released one a custom goal turns into. */
export type Adding = { kind: "character" | "weapon"; replacing?: string }

type Props = {
  adding: Adding | null
  account: Account
  plan: Plan
  onClose: () => void
  onAdd: (goal: NewGoal) => void
}

/**
 * Tiles of the account's characters or weapons first, then the game's others,
 * to pick one; one not out yet heads them, and planned ones are left out. A
 * custom goal keeps its EXP boost when it turns into a real one, so the boost
 * is offered only for a new weapon.
 */
export function AddGoal({ adding, account, plan, onClose, onAdd }: Props) {
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [boost, setBoost] = useState(false)
  const kind = adding?.kind
  const replacing = adding?.replacing !== undefined
  const options = useMemo(() => {
    if (kind === undefined) return []
    return kind === "weapon" ? weaponOptions(account, plan) : characterOptions(account, plan)
  }, [kind, account, plan])
  const reset = () => {
    setQuery("")
    setFilters(NO_FILTERS)
    setBoost(false)
  }
  const pick = (goal: NewGoal) => {
    reset()
    onAdd(withExpBoost(goal, boost))
  }
  return (
    <AlertDialog
      isOpen={adding !== null}
      onOpenChange={open => {
        if (open) return
        reset()
        onClose()
      }}
    >
      <AlertDialog.Backdrop isDismissable isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="max-w-[720px]">
            <AlertDialog.Header>
              <AlertDialog.Heading>
                {kind && (replacing ? t.replace[kind] : t.addTitle[kind])}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-3">
              {kind && (
                <>
                  <div className="flex items-center gap-2">
                    {/* A column, so the search box fills the row as it does on its own. */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <SearchBox value={query} onChange={setQuery} label={t.search} />
                    </div>
                    {kind === "weapon" && !replacing && (
                      <CheckboxField checked={boost} label={t.expBoost} onChange={setBoost} />
                    )}
                  </div>
                  <GoalPicker
                    kind={kind}
                    options={shownOptions(options, query, filters)}
                    filters={filters}
                    onFilters={setFilters}
                    onCustom={replacing ? undefined : () => pick(customGoal(kind, plan.defaults))}
                    onPick={option => pick(option.goal())}
                  />
                </>
              )}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="secondary">
                {t.close}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
