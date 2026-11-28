// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"
import { navigate } from "@/lib/route"
import { text } from "@/text"
import type { Neighbors } from "./detail"

/**
 * The way back to the list and the character's name on the left, its place
 * in the list and the previous and next buttons on the right. Without a name
 * only the way back shows.
 */
export function DetailHeader({ name, order }: { name?: string; order?: Neighbors }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label={text.characterDetail.where} className="flex items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={() => navigate("characters")}
          className="flex h-8 cursor-pointer items-center gap-1 rounded-[8px] pr-2 pl-1 text-muted transition-colors duration-150 hover:bg-default/60 hover:text-foreground motion-reduce:transition-none"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {text.characterDetail.back}
        </button>
        {name !== undefined && (
          <>
            <span aria-hidden className="text-muted">
              /
            </span>
            <span aria-current="page" className="font-semibold">
              {name}
            </span>
          </>
        )}
      </nav>
      {order && (
        <div className="flex items-center gap-2">
          <span className="tabular text-[12px] text-muted">
            {text.characterDetail.position(order.at, order.total)}
          </span>
          <StepButton to={order.previous} className="pr-2.5 pl-1.5">
            <ChevronLeft aria-hidden className="size-[15px]" />
            {text.characterDetail.previous}
          </StepButton>
          <StepButton to={order.next} className="pr-1.5 pl-2.5">
            {text.characterDetail.next}
            <ChevronRight aria-hidden className="size-[15px]" />
          </StepButton>
        </div>
      )}
    </div>
  )
}

type StepProps = { to: string; className: string; children: ReactNode }

function StepButton({ to, className, children }: StepProps) {
  return (
    <button
      type="button"
      onClick={() => navigate("characters", to)}
      className={cn(
        "flex h-8 cursor-pointer items-center gap-1 rounded-[8px] border border-border bg-surface text-[13px] transition-colors duration-150 hover:bg-default/60 motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </button>
  )
}
