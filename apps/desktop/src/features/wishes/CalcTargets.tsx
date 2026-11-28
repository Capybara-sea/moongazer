// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { AlertDialog, Button } from "@heroui/react"
import { GripVertical, X } from "lucide-react"
import { useMemo, useState } from "react"
import { GameIcon } from "@/components/GameIcon"
import { iconTone } from "@/components/RarityChip"
import { SearchBox } from "@/components/SearchBox"
import { Tip } from "@/components/Tip"
import type { Account } from "@/domain/account"
import { featuredHistory, itemOf } from "@/domain/wishes"
import { text } from "@/i18n"
import { cn } from "@/lib/cn"
import { useDragOrder } from "@/lib/useDragOrder"
import { ChanceBar } from "./calcParts"
import { itemView } from "./items"

const t = text.wishes.calc

/** A wanted item: a character to a constellation (0 is C0), or a weapon to a refinement. */
export type Target = { id: number; kind: "characters" | "weapons"; itemId: number; to: number }

/** The account's constellation of a character (-1 without it), or best refinement of a weapon (0). */
function current(target: Pick<Target, "kind" | "itemId">, account: Account | undefined) {
  const key = itemOf(target.itemId)?.key
  if (target.kind === "characters") {
    return account?.characters.find(c => c.key === key)?.constellation ?? -1
  }
  return Math.max(0, ...(account?.weapons ?? []).filter(w => w.key === key).map(w => w.refinement))
}

/** Copies a target still takes. */
export function copiesFor(target: Target, account: Account | undefined) {
  return Math.max(0, target.to - current(target, account))
}

type Props = {
  account: Account | undefined
  targets: readonly Target[]
  onTargets: (targets: Target[]) => void
  odds: (characters: number, weapons: number) => { chance: number; mean: number }
}

/**
 * Targets in the order they are wished for, each with the chance and the
 * average wishes up to it: characters and weapons add up on their banners.
 */
export function CalcTargets({ account, targets, onTargets, odds }: Props) {
  const [adding, setAdding] = useState<"characters" | "weapons" | null>(null)
  const drag = useDragOrder((from, to) => {
    const next = [...targets]
    const [moved] = next.splice(from, 1)
    if (moved) next.splice(to, 0, moved)
    onTargets(next)
  })
  let characters = 0
  let weapons = 0
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[12px] text-muted">{t.multiHint}</span>
      {targets.length === 0 && (
        <p className="py-4 text-center text-[13px] text-muted">{t.noTargets}</p>
      )}
      {targets.map((target, index) => {
        const copies = copiesFor(target, account)
        if (target.kind === "characters") characters += copies
        else weapons += copies
        const { chance, mean } = odds(characters, weapons)
        const { name, icon } = itemView(target.itemId)
        const now = current(target, account)
        const levels = target.kind === "characters" ? [-1, 0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5]
        const label = (level: number) =>
          level < (target.kind === "characters" ? 0 : 1)
            ? text.number.missing
            : target.kind === "characters"
              ? t.cons(level)
              : t.refine(level)
        return (
          <div
            key={target.id}
            {...drag.item(index)}
            className="grid grid-cols-[18px_56px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-[12px] border border-border bg-surface-secondary px-3 py-2.5"
          >
            <button
              type="button"
              {...drag.handle(index)}
              aria-label={t.drag(name)}
              className="row-span-2 flex h-7 w-[18px] cursor-grab items-center justify-center rounded-[6px] text-muted hover:bg-default/60"
            >
              <GripVertical aria-hidden size={15} />
            </button>
            <GameIcon
              icon={icon}
              label={name}
              className={cn("row-span-2 size-14 rounded-[12px] text-[18px]", iconTone(5))}
            />
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <b className="font-semibold text-[14px]">{name}</b>
              <span className="text-[11px] text-muted">
                {[
                  target.kind === "characters" ? t.character : t.weapon,
                  now < (target.kind === "characters" ? 0 : 1) ? t.notOwned : t.have(label(now)),
                ].join(" · ")}
              </span>
              <span className="flex gap-0.5 rounded-[8px] bg-surface p-0.5">
                {levels.map(level => (
                  <button
                    key={level}
                    type="button"
                    disabled={level <= now}
                    aria-pressed={level === target.to}
                    aria-label={t.stepLabel(label(level))}
                    onClick={() =>
                      onTargets(targets.map(x => (x.id === target.id ? { ...x, to: level } : x)))
                    }
                    className={cn(
                      "min-w-6 rounded-[6px] px-[5px] text-[11px] leading-5",
                      level === target.to
                        ? "bg-accent font-semibold text-accent-foreground"
                        : level === now
                          ? "bg-surface-secondary font-semibold"
                          : level > now && level < target.to
                            ? "cursor-pointer bg-(--accent-soft) text-(--accent-text)"
                            : level > now
                              ? "cursor-pointer text-muted hover:text-foreground"
                              : "text-muted",
                    )}
                  >
                    {label(level)}
                  </button>
                ))}
              </span>
            </div>
            <Tip content={t.remove(name)} className="contents">
              <button
                type="button"
                aria-label={t.remove(name)}
                onClick={() =>
                  drag.rearrange(() => onTargets(targets.filter(x => x.id !== target.id)))
                }
                className="flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-default/60"
              >
                <X aria-hidden size={15} />
              </button>
            </Tip>
            <div className="col-span-2 col-start-3 grid grid-cols-[minmax(0,1fr)_132px] items-center gap-3 tabular">
              <ChanceBar chance={chance} />
              <span className="text-right text-[13px]">{t.cumulative(mean)}</span>
            </div>
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        {(["characters", "weapons"] as const).map(kind => (
          <button
            key={kind}
            type="button"
            onClick={() => setAdding(kind)}
            className="h-8 cursor-pointer rounded-[9px] border border-border border-dashed px-3 text-[13px] hover:bg-default/60"
          >
            {kind === "characters" ? t.addCharacter : t.addWeapon}
          </button>
        ))}
      </div>
      <Picker
        kind={adding}
        onClose={() => setAdding(null)}
        onPick={itemId => {
          const kind = adding ?? "characters"
          const now = current({ kind, itemId }, account)
          const to = Math.min(
            kind === "characters" ? 6 : 5,
            Math.max(now + 1, kind === "characters" ? 0 : 1),
          )
          onTargets([...targets, { id: Date.now(), kind, itemId, to }])
          setAdding(null)
        }}
      />
    </div>
  )
}

/** Featured five-stars of a kind, the most recently featured first. */
function Picker({
  kind,
  onClose,
  onPick,
}: {
  kind: "characters" | "weapons" | null
  onClose: () => void
  onPick: (itemId: number) => void
}) {
  const [query, setQuery] = useState("")
  const items = useMemo(
    () =>
      featuredHistory()
        .filter(item => item.rank === 5 && item.kind === kind)
        .map(item => ({
          itemId: item.itemId,
          last: Math.max(...item.times.map(time => time.version * 2 + time.half)),
          ...itemView(item.itemId),
        }))
        .sort((a, b) => b.last - a.last),
    [kind],
  )
  const shown = items.filter(item => query === "" || item.name.includes(query.trim()))
  return (
    <AlertDialog
      isOpen={kind !== null}
      onOpenChange={open => {
        if (open) return
        setQuery("")
        onClose()
      }}
    >
      <AlertDialog.Backdrop isDismissable isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="w-[640px] max-w-full">
            <AlertDialog.Header>
              <AlertDialog.Heading>
                {kind === "weapons" ? t.pickWeapon : t.pickCharacter}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-3">
              <SearchBox value={query} onChange={setQuery} label={t.pickSearch} />
              <div className="grid h-[360px] auto-rows-min grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2 overflow-y-auto">
                {shown.map(item => (
                  <button
                    key={item.itemId}
                    type="button"
                    onClick={() => {
                      setQuery("")
                      onPick(item.itemId)
                    }}
                    className="flex cursor-pointer flex-col items-center gap-1 rounded-[10px] p-1.5 hover:bg-default/60"
                  >
                    <GameIcon
                      icon={item.icon}
                      label={item.name}
                      className={cn("size-14 rounded-[12px]", iconTone(5))}
                    />
                    <span className="w-full truncate text-center text-[12px]">{item.name}</span>
                  </button>
                ))}
              </div>
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
