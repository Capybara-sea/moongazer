// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useTheme } from "@heroui/react"
import { Monitor, Moon, Sun } from "lucide-react"
import { flushSync } from "react-dom"
import { revealFrom } from "@/lib/motion"
import { text } from "@/text/zh"

const MODES = [
  { theme: "light", Icon: Sun, label: text.theme.light },
  { theme: "dark", Icon: Moon, label: text.theme.dark },
  { theme: "system", Icon: Monitor, label: text.theme.system },
] as const

/**
 * Steps through light, dark and following the system, and shows the mode in
 * use. A new look spreads out from the button; flushSync lets useTheme's
 * layout effect swap the theme class on <html> while the view transition
 * waits for it. When the next mode looks the same, only the label changes.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme("system")
  const index = MODES.findIndex(m => m.theme === theme)
  const { Icon, label } = MODES[index] ?? MODES[2]
  const next = MODES[(index + 1) % MODES.length] ?? MODES[0]
  return (
    <button
      type="button"
      onClick={e => {
        const system = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
        const looks = next.theme === "system" ? system : next.theme
        if (looks === resolvedTheme) setTheme(next.theme)
        else
          revealFrom(e.currentTarget.getBoundingClientRect(), () =>
            flushSync(() => setTheme(next.theme)),
          )
      }}
      aria-label={text.theme.toggle}
      className="flex h-9 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-[6px] border border-border px-3 text-left text-[13px] text-muted transition-colors hover:bg-default/60 hover:text-foreground motion-reduce:transition-none"
    >
      <Icon size={16} aria-hidden />
      {label}
    </button>
  )
}
