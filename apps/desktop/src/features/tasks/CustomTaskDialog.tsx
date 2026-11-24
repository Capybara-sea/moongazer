// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button, Popover } from "@heroui/react"
import { type ReactNode, useState } from "react"
import { nextDailyReset } from "@/domain/gameTime"
import {
  ANCHORS,
  type CustomTask,
  isValidCustomTask,
  MAX_REPEAT_DAYS,
  REPEATS,
  removeCustomTask,
  saveCustomTask,
} from "@/domain/tasks"
import { Choice } from "@/features/planner/Choice"
import { formatTime } from "@/lib/format"
import { useTasksStore } from "@/stores/tasksStore"
import { text } from "@/text/zh"
import { dayInput, parseDayInput } from "./taskText"

const t = text.tasks.dialog

/** The task in the dialog: a new one, or one saved before. */
export type Editing = { task: CustomTask; isNew: boolean }

type Props = { editing: Editing | null; onClose: () => void }

/** Adds a task of the player's own, or changes or deletes one. */
export function CustomTaskDialog({ editing, onClose }: Props) {
  return (
    <AlertDialog isOpen={editing !== null} onOpenChange={open => open || onClose()}>
      <AlertDialog.Backdrop isDismissable isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="max-w-[460px]">
            {editing && <Form key={editing.task.id} {...editing} onClose={onClose} />}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}

const FIELD =
  "flex h-9 items-center gap-2 rounded-[9px] border border-(--field-border) bg-(--field-background) px-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2"
const INPUT = "min-w-0 flex-1 bg-transparent text-foreground outline-none"

function Form({ task, isNew, onClose }: Editing & { onClose: () => void }) {
  const [name, setName] = useState(task.name)
  const [repeat, setRepeat] = useState(task.repeat)
  const [days, setDays] = useState(String(task.days))
  const [start, setStart] = useState(dayInput(task.startDay))
  const [anchor, setAnchor] = useState(task.anchor)
  const [note, setNote] = useState(task.note)
  const startDay = parseDayInput(start)
  const n = Number(days)
  const daysValid = Number.isInteger(n) && n >= 1 && n <= MAX_REPEAT_DAYS
  const draft: CustomTask | undefined =
    startDay === undefined || (repeat === "days" && !daysValid)
      ? undefined
      : {
          ...task,
          name: name.trim(),
          repeat,
          days: daysValid ? n : task.days,
          startDay,
          anchor,
          note: note.trim(),
        }
  const { change } = useTasksStore.getState()
  return (
    <>
      <AlertDialog.Header>
        <AlertDialog.Heading>{isNew ? t.newTitle : t.editTitle}</AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body className="flex flex-col gap-3 text-[13px]">
        <label className={FIELD}>
          <span className="flex-none text-muted">{t.name}</span>
          <input value={name} onChange={e => setName(e.currentTarget.value)} className={INPUT} />
        </label>
        <Row label={t.repeat}>
          {REPEATS.map(option => (
            <Choice
              key={option}
              label={t.repeats[option]}
              selected={repeat === option}
              onPick={() => setRepeat(option)}
              className="px-3"
            />
          ))}
          {repeat === "days" && (
            <label className={FIELD}>
              <span className="sr-only">{t.days}</span>
              <input
                type="number"
                min={1}
                max={MAX_REPEAT_DAYS}
                value={days}
                onChange={e => setDays(e.currentTarget.value)}
                className={`${INPUT} tabular w-14`}
              />
              <span className="flex-none text-muted">{t.daysUnit}</span>
            </label>
          )}
        </Row>
        <label className={`${FIELD} self-start`}>
          <span className="flex-none text-muted">{t.startDay}</span>
          <input
            type="date"
            required
            value={start}
            onChange={e => setStart(e.currentTarget.value)}
            className={`${INPUT} tabular`}
          />
        </label>
        <Row label={t.anchor}>
          {ANCHORS.map(option => (
            <Choice
              key={option}
              label={t.anchors[option]}
              selected={anchor === option}
              onPick={() => setAnchor(option)}
              className="px-3"
            />
          ))}
        </Row>
        <p className="text-[12px] text-muted">{t.anchorHint[anchor]}</p>
        <label className={FIELD}>
          <span className="flex-none text-muted">{t.note}</span>
          <input value={note} onChange={e => setNote(e.currentTarget.value)} className={INPUT} />
        </label>
        <p className="text-[12px] text-muted">
          {t.dayHint(formatTime(nextDailyReset(Date.now())))}
        </p>
      </AlertDialog.Body>
      <AlertDialog.Footer>
        {!isNew && (
          <Remove
            onRemove={() => {
              change(doc => removeCustomTask(doc, task.id))
              onClose()
            }}
          />
        )}
        <Button slot="close" variant="tertiary">
          {t.cancel}
        </Button>
        <Button
          variant="primary"
          isDisabled={draft === undefined || !isValidCustomTask(draft)}
          onPress={() => {
            if (draft) change(doc => saveCustomTask(doc, draft))
            onClose()
          }}
        >
          {t.save}
        </Button>
      </AlertDialog.Footer>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span aria-hidden className="w-16 flex-none text-muted">
        {label}
      </span>
      {children}
    </fieldset>
  )
}

/** Deleting cannot be undone, so it asks once more beside the button. */
function Remove({ onRemove }: { onRemove: () => void }) {
  return (
    <Popover>
      <Button variant="danger-soft" className="mr-auto">
        {t.delete}
      </Button>
      <Popover.Content
        placement="top start"
        offset={6}
        className="glass w-[236px] rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
      >
        <Popover.Dialog
          aria-label={t.delete}
          className="flex flex-col gap-3 p-3.5 text-[13px] outline-none"
        >
          <p>{t.deleteAsk}</p>
          <div className="flex justify-end gap-2">
            <Button slot="close" variant="tertiary" size="sm">
              {t.cancel}
            </Button>
            <Button variant="danger" size="sm" onPress={onRemove}>
              {t.delete}
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
