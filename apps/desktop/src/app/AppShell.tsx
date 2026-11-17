// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import iconUrl from "@logo/icon.svg?url"
import { Gem, House, Info, LayoutDashboard, Package, Settings, Sword, Users } from "lucide-react"
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import { motionAllowed } from "@/lib/motion"
import { navigate, type PageKey, usePage } from "@/lib/route"
import { text } from "@/text/zh"
import { PAGES } from "./route"
import { ThemeToggle } from "./ThemeToggle"

const NAV_ICONS = {
  home: House,
  overview: LayoutDashboard,
  characters: Users,
  weapons: Sword,
  artifacts: Gem,
  materials: Package,
  settings: Settings,
  about: Info,
} as const

/** How long the outgoing page stays on screen: its transition in index.css. */
const LEAVE_MS = 420

type Props = { pages: Record<PageKey, ReactNode> }

function pageIndex(page: PageKey) {
  return PAGES.findIndex(p => p.key === page)
}

/**
 * Title bar on top, side menu on the left and the page on the right. A page
 * stays mounted after its first visit and is only hidden, so forms, progress
 * and scroll positions survive switching.
 */
export function AppShell({ pages }: Props) {
  const page = usePage()
  const index = pageIndex(page)
  // Mounted during render, not in an effect, so a first visit shows in the
  // same frame as the switch.
  const [mounted, setMounted] = useState<Set<PageKey>>(() => new Set([page]))
  if (!mounted.has(page)) {
    setMounted(new Set(mounted).add(page))
  }
  // The incoming page rises when the user moves down the menu, sinks when up.
  // The outgoing one stays on screen behind it while it drops back. When the
  // user goes back before it is gone, the two keep their order: swapping them
  // while both are half transparent made the view jump.
  const [entered, setEntered] = useState({ page, up: true })
  const [leaving, setLeaving] = useState<PageKey | null>(null)
  const [front, setFront] = useState(page)
  if (entered.page !== page) {
    setEntered({ page, up: index > pageIndex(entered.page) })
    setLeaving(motionAllowed() ? entered.page : null)
    if (page !== leaving) setFront(page)
  }
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setLeaving(null), LEAVE_MS)
    return () => clearTimeout(timer)
  }, [leaving])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={text.nav.label}
          className="glass flex w-44 flex-none flex-col border-border border-r bg-surface px-2 py-3 [--glass-shadow:none]"
        >
          <SideMenu page={page} />
          <span className="min-h-4 flex-1" />
          <ThemeToggle />
        </nav>
        {/* Each page scrolls on its own and main clips, so a page sliding in
            never makes main overflow and flash a scrollbar. */}
        <main
          className={cn(
            "relative min-h-0 min-w-0 flex-1 overflow-clip",
            entered.up ? "[--page-shift:12px]" : "[--page-shift:-12px]",
          )}
        >
          {PAGES.map(p =>
            mounted.has(p.key) ? (
              <section
                key={p.key}
                data-page={p.key}
                data-leaving={p.key === leaving || undefined}
                hidden={p.key !== page && p.key !== leaving}
                inert={p.key === leaving}
                className={cn(
                  "h-full min-h-0 overflow-auto [scrollbar-gutter:stable]",
                  p.key === leaving ? "absolute inset-0" : "relative",
                  p.key === front ? "z-2" : "z-1",
                )}
              >
                {pages[p.key]}
              </section>
            ) : null,
          )}
        </main>
      </div>
    </div>
  )
}

/** The menu items, with one highlight that slides to the current page. */
function SideMenu({ page }: { page: PageKey }) {
  const items = useRef(new Map<PageKey, HTMLButtonElement>())
  // Measured, since group labels and dividers make the rows uneven. Before
  // paint, so the highlight never shows at the old place.
  const [highlight, setHighlight] = useState<{ top: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const item = items.current.get(page)
    if (item) setHighlight({ top: item.offsetTop, height: item.offsetHeight })
  }, [page])

  return (
    <div className="relative flex flex-col gap-0.5">
      {highlight && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 rounded-[6px] bg-(--accent-soft) transition-transform duration-200 ease-(--ease-out-soft) before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent motion-reduce:transition-none"
          style={{ height: highlight.height, transform: `translateY(${highlight.top}px)` }}
        />
      )}
      {PAGES.map((p, i) => {
        const active = p.key === page
        const Icon = NAV_ICONS[p.key]
        return (
          <div key={p.key} className="contents">
            {p.group && p.group !== PAGES[i - 1]?.group && (
              <span className="px-3 pt-3 pb-1 text-[11px] text-muted tracking-[0.08em]">
                {p.group}
              </span>
            )}
            {p.divider && <span aria-hidden className="mx-3 my-2 h-px bg-(--separator)" />}
            <button
              ref={element => {
                if (element) items.current.set(p.key, element)
                else items.current.delete(p.key)
              }}
              type="button"
              onClick={() => navigate(p.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-9 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-[6px] px-3 text-left text-sm transition-colors",
                active
                  ? "font-medium text-foreground"
                  : "text-muted hover:bg-default/60 hover:text-foreground",
              )}
            >
              <Icon size={17} aria-hidden />
              {p.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The window is frameless; tauri-plugin-decorum finds this element by its
 * data attribute and appends the minimize, maximize and close buttons.
 * Only elements that carry data-tauri-drag-region themselves drag the window,
 * so the icon and the label ignore the pointer.
 *
 * decorum looks for this element at DOMContentLoaded, before React renders,
 * so it also adds its own fixed drag strip (z-index 100) across the top. The
 * z-[101] keeps this bar and its buttons above that strip.
 */
function TitleBar() {
  return (
    <header
      data-tauri-decorum-tb=""
      className="glass relative z-[101] box-content flex h-8 flex-none items-stretch border-border border-b bg-surface [--glass-shadow:none]"
    >
      <div data-tauri-drag-region="" className="flex flex-1 items-center gap-2 px-3">
        <img
          src={iconUrl}
          alt=""
          width={16}
          height={16}
          className="pointer-events-none size-4 rounded"
        />
        <span className="pointer-events-none font-semibold text-xs tracking-[0.04em]">
          {text.appName}
        </span>
        {/* Only under the dev server, so a dev window is never taken for a release. */}
        {import.meta.env.DEV && (
          <span className="pointer-events-none rounded-[5px] border border-(--warn) px-1.5 text-(--warn) text-[11px] leading-4">
            {text.devBuild}
          </span>
        )}
      </div>
    </header>
  )
}
