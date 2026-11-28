// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button } from "@heroui/react"
import { Plus } from "lucide-react"
import { useState } from "react"
import { CardHeader } from "@/components/CardHeader"
import { CheckboxField } from "@/components/CheckboxField"
import { Panel } from "@/components/Panel"
import { Segmented } from "@/components/Segmented"
import { Tip } from "@/components/Tip"
import { gameDay } from "@/domain/gameTime"
import type { TaskRow } from "@/domain/tasks"
import { text } from "@/i18n"
import { CustomTaskDialog, type Editing } from "./CustomTaskDialog"
import { ShownTasks } from "./ShownTasks"
import { TaskItem } from "./TaskItem"
import { inTab, isShown, onTodo, TABS, type Tab, tabCounts, useTodoPrefs } from "./taskFilter"
import type { TaskBoard } from "./useTaskBoard"

const t = text.tasks

type Props = {
  board: TaskBoard
  uid: number | null
  now: number
}

/**
 * The tasks to tick off: the events running (the Stygian Onslaught's is on
 * the challenge card), the standing tasks and the player's own, by tab. Done
 * ones fade where they are, unless hidden. Two columns from the default window up.
 */
export function TodoCard({ board, uid, now }: Props) {
  const [prefs, setPrefs] = useTodoPrefs()
  const [tab, setTab] = useState<Tab>("all")
  // Rows done here while done ones are hidden stay till the tab or the switch changes, so the
  // tick just pressed keeps the keyboard's focus.
  const [stay, setStay] = useState<ReadonlySet<string>>(new Set())
  const [editing, setEditing] = useState<Editing | null>(null)
  // The dialog saves to the account read, so another account shown closes it.
  const [editingUid, setEditingUid] = useState(uid)
  if (editingUid !== uid) {
    setEditingUid(uid)
    setEditing(null)
    setStay(new Set())
  }
  const { doc, editable, problem } = board
  const shown = board.rows.filter(row => onTodo(row) && isShown(row, prefs))
  const listed = shown.filter(
    row => inTab(row, tab) && !(prefs.hideDone && row.done && !stay.has(row.id)),
  )
  const keep = (row: TaskRow) => setStay(new Set(stay).add(row.id))
  return (
    <Panel aria-label={t.todo} className="min-w-0 flex-[2_1_560px] gap-0 px-[18px] pt-3.5 pb-2">
      <CardHeader
        title={t.todo}
        lead={
          <Tabs
            tab={tab}
            counts={tabCounts(shown)}
            onChange={next => {
              if (next === tab) return
              setTab(next)
              setStay(new Set())
            }}
          />
        }
      >
        <CheckboxField
          checked={prefs.hideDone}
          label={t.hideDone}
          onChange={hideDone => {
            setPrefs({ ...prefs, hideDone })
            setStay(new Set())
          }}
        />
        <ShownTasks
          prefs={prefs}
          onChange={setPrefs}
          custom={doc.custom}
          editable={editable}
          onEdit={task => setEditing({ task, isNew: false })}
        />
        <Tip content={t.newTask} className="flex">
          <Button
            variant="secondary"
            isIconOnly
            aria-label={t.newTask}
            isDisabled={!editable}
            onPress={() => setEditing({ task: newTask(now), isNew: true })}
            className="size-9 min-w-0 flex-none rounded-[9px]"
          >
            <Plus aria-hidden size={16} />
          </Button>
        </Tip>
      </CardHeader>
      {problem && <p className="pb-2 text-[12px] text-muted">{problem}</p>}
      {listed.length === 0 ? (
        <p className="py-3 text-[13px] text-muted">{emptyText(shown, tab, prefs.hideDone)}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-x-5">
          {listed.map(row => (
            <TaskItem
              key={row.id}
              row={row}
              now={now}
              editable={editable}
              onToggle={() => {
                keep(row)
                board.toggle(row)
              }}
              onToggleJudging={() => {
                keep(row)
                board.toggleJudging(row)
              }}
            />
          ))}
        </ul>
      )}
      <CustomTaskDialog editing={editing} onClose={() => setEditing(null)} />
    </Panel>
  )
}

function newTask(now: number): Editing["task"] {
  return {
    id: crypto.randomUUID(),
    name: "",
    repeat: "daily",
    days: 1,
    startDay: gameDay(now),
    anchor: "start",
    note: "",
  }
}

/** Why a tab lists nothing: all of it done and hidden, or nothing in it. */
function emptyText(shown: readonly TaskRow[], tab: Tab, hideDone: boolean) {
  if (hideDone && shown.some(row => inTab(row, tab))) return t.allDone
  return tab === "custom" ? t.customEmpty : t.empty
}

type TabsProps = { tab: Tab; counts: Record<Tab, number>; onChange: (tab: Tab) => void }

/** The tabs, each with how many of its tasks are still to do. */
function Tabs({ tab, counts, onChange }: TabsProps) {
  return (
    <Segmented
      label={t.tabsLabel}
      value={tab}
      options={TABS.map(option => ({
        value: option,
        label: (
          <>
            {t.tabs[option]}
            <span className="tabular ml-1.5 font-normal text-[12px] text-muted">
              {counts[option]}
            </span>
          </>
        ),
      }))}
      onPick={onChange}
    />
  )
}
