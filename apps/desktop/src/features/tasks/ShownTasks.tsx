// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Button, Popover } from "@heroui/react"
import { ListChecks, Pencil } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Switch } from "@/components/Switch"
import { Tip } from "@/components/Tip"
import { ACTIVITY_GROUPS } from "@/domain/activities"
import { STANDING_TASKS } from "@/domain/standingTasks"
import type { CustomTask } from "@/domain/tasks"
import { cn } from "@/lib/cn"
import { text } from "@/text"
import { type Prefs, withHidden } from "./taskFilter"

const t = text.tasks

type Props = {
  prefs: Prefs
  onChange: (prefs: Prefs) => void
  custom: readonly CustomTask[]
  editable: boolean
  onEdit: (task: CustomTask) => void
}

/**
 * Which tasks the to-do card shows: a switch per standing task and per group of
 * events; the player's own tasks are always shown, and edited from here.
 */
export function ShownTasks({ prefs, onChange, custom, editable, onEdit }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Tip content={t.shown} className="flex">
        <Button
          variant="secondary"
          isIconOnly
          aria-label={t.shown}
          className="size-9 min-w-0 flex-none rounded-[9px]"
        >
          <ListChecks aria-hidden size={16} />
        </Button>
      </Tip>
      <Popover.Content
        placement="bottom end"
        offset={6}
        className="glass w-[440px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) p-0 shadow-(--pop-shadow)"
      >
        <Popover.Dialog
          aria-label={t.shown}
          className="flex flex-col gap-4 p-4 text-[13px] outline-none"
        >
          <Section title={t.shownSections.standing}>
            {STANDING_TASKS.map(task => (
              <SwitchRow
                key={task}
                name={t.standing[task]}
                on={!prefs.hiddenTasks.has(task)}
                onChange={on =>
                  onChange({ ...prefs, hiddenTasks: withHidden(prefs.hiddenTasks, task, !on) })
                }
              />
            ))}
          </Section>
          <Section title={t.shownSections.events} className="border-border border-t pt-3">
            {ACTIVITY_GROUPS.map(group => (
              <SwitchRow
                key={group}
                name={t.groups[group]}
                on={!prefs.hiddenGroups.has(group)}
                onChange={on =>
                  onChange({ ...prefs, hiddenGroups: withHidden(prefs.hiddenGroups, group, !on) })
                }
              />
            ))}
          </Section>
          <section className="flex flex-col gap-1.5 border-border border-t pt-3">
            <h3 className="font-semibold">{t.shownSections.custom}</h3>
            {custom.length === 0 ? (
              <p className="text-[12px] text-muted">{t.noCustom}</p>
            ) : (
              <ul className="flex flex-col">
                {custom.map(task => (
                  <li key={task.id} className="flex h-8 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{task.name}</span>
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      aria-label={t.edit(task.name)}
                      isDisabled={!editable}
                      onPress={() => {
                        setOpen(false)
                        onEdit(task)
                      }}
                      className="size-7 min-w-0 rounded-[8px] text-muted"
                    >
                      <Pencil aria-hidden size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}

type SectionProps = { title: string; className?: string; children: ReactNode }

function Section({ title, className, children }: SectionProps) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      <h3 className="font-semibold">{title}</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">{children}</div>
    </section>
  )
}

type SwitchRowProps = { name: string; on: boolean; onChange: (on: boolean) => void }

function SwitchRow({ name, on, onChange }: SwitchRowProps) {
  return (
    <div className="flex h-8 items-center justify-between gap-2">
      <span className="min-w-0 truncate">{name}</span>
      <Switch checked={on} label={t.shownLabel(name)} onChange={onChange} />
    </div>
  )
}
