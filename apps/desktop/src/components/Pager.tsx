// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"
import { pageItems } from "@/lib/usePages"
import { text } from "@/text/zh"

const t = text.pager
const BUTTON =
  "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-[8px] px-2 text-[13px] tabular transition-colors duration-150 ease-(--ease-out-soft) disabled:cursor-default disabled:opacity-40 motion-reduce:transition-none"

type Props = { page: number; pages: number; onPage: (page: number) => void }

/**
 * Previous, the page numbers and next, held at the bottom of the window while
 * the list scrolls; nothing for a single page. Pages count from 0 here and
 * from 1 on screen.
 */
export function Pager({ page, pages, onPage }: Props) {
  if (pages <= 1) return null
  // A gap is keyed by the page before it: gaps never sit side by side.
  let before = -1
  const step = (to: number, label: string, icon: ReactNode) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={to < 0 || to >= pages}
      onClick={() => onPage(to)}
      className={cn(BUTTON, "enabled:hover:bg-default/60")}
    >
      {icon}
    </button>
  )
  return (
    <nav
      aria-label={t.label}
      className="glass sticky bottom-3 z-10 flex flex-wrap items-center gap-1 self-center rounded-[12px] border border-border bg-(--overlay-glass,var(--overlay)) p-1.5 shadow-(--pop-shadow)"
    >
      {step(page - 1, t.previous, <ChevronLeft aria-hidden className="size-4" />)}
      {pageItems(page, pages).map(item => {
        if (item === "gap") {
          return (
            <span key={`gap-${before}`} aria-hidden className="w-6 text-center text-muted">
              …
            </span>
          )
        }
        before = item
        return (
          <button
            key={item}
            type="button"
            aria-label={t.page(item + 1)}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPage(item)}
            className={cn(
              BUTTON,
              item === page
                ? "bg-accent font-semibold text-accent-foreground"
                : "hover:bg-default/60",
            )}
          >
            {item + 1}
          </button>
        )
      })}
      {step(page + 1, t.next, <ChevronRight aria-hidden className="size-4" />)}
      <span className="px-2 text-[12px] text-muted tabular">{t.position(page + 1, pages)}</span>
    </nav>
  )
}
