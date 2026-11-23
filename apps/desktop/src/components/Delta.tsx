// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Fragment } from "react"
import { cn } from "@/lib/cn"
import type { Labeled, Signed, Way } from "@/lib/format"

const WAY: Record<Way, string> = {
  gain: "text-(--ok)",
  loss: "text-(--err)",
  same: "text-muted",
}

/** A signed change or new value: green for a gain, red for a loss, muted for none. */
export function Delta({ signed, className }: { signed: Signed; className?: string }) {
  return <span className={cn("whitespace-nowrap", WAY[signed.way], className)}>{signed.text}</span>
}

/** A label in the text color, then its change. */
export function LabeledText({ item }: { item: Labeled }) {
  return (
    <>
      {item.label}
      {item.change && (
        <>
          {" "}
          <Delta signed={item.change} />
        </>
      )}
    </>
  )
}

/** Labels with their changes between muted dots: "Mora +126,000 · Primogems +160". */
export function LabeledList({ items }: { items: readonly Labeled[] }) {
  // Two copies of one weapon raised alike make the same line twice.
  const seen = new Map<string, number>()
  return items.map((item, i) => {
    const line = item.label + (item.change?.text ?? "")
    const copy = seen.get(line) ?? 0
    seen.set(line, copy + 1)
    return (
      <Fragment key={`${line}#${copy}`}>
        {i > 0 && <span className="text-muted"> · </span>}
        <LabeledText item={item} />
      </Fragment>
    )
  })
}
