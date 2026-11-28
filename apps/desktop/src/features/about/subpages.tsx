// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ChevronLeft, ChevronRight } from "lucide-react"
import { navigate } from "@/lib/route"
import { text } from "@/text"

/** About's pages inside it, at #/about/<name>. */
export const SUBPAGES = { licenses: "licenses", changelog: "changelog" } as const
export type Subpage = (typeof SUBPAGES)[keyof typeof SUBPAGES]

/** "‹ About / title" at the top of a page inside About. */
export function SubpageNav({ title }: { title: string }) {
  return (
    <nav aria-label={text.about.where} className="flex items-center gap-1.5 text-sm">
      <button
        type="button"
        onClick={() => navigate("about")}
        className="flex h-8 cursor-pointer items-center gap-1 rounded-[8px] pr-2 pl-1 text-muted transition-colors duration-150 hover:bg-default/60 hover:text-foreground motion-reduce:transition-none"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {text.about.back}
      </button>
      <span aria-hidden className="text-muted">
        /
      </span>
      <span aria-current="page" className="font-semibold">
        {title}
      </span>
    </nav>
  )
}

/** "label ›" at a card's top right, opening a page inside About. */
export function SubpageLink({ to, label }: { to: Subpage; label: string }) {
  return (
    <button
      type="button"
      onClick={() => navigate("about", to)}
      className="flex h-[30px] flex-none cursor-pointer items-center gap-0.5 rounded-[8px] pr-1 pl-2 text-(--accent-text) text-[13px] transition-colors duration-150 hover:bg-default/60 motion-reduce:transition-none"
    >
      {label}
      <ChevronRight aria-hidden className="size-4" />
    </button>
  )
}
