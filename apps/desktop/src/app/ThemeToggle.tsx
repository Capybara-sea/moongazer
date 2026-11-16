// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { Monitor, Moon, Sun } from "lucide-react"
import { useAppearanceStore } from "@/stores/appearanceStore"
import { text } from "@/text/zh"

const MODES = [
  { theme: "light", Icon: Sun, label: text.theme.light },
  { theme: "dark", Icon: Moon, label: text.theme.dark },
  { theme: "system", Icon: Monitor, label: text.theme.system },
] as const

/**
 * Steps through light, dark and following the system, and shows the mode in
 * use. A new look spreads out from the button; when the next mode looks the
 * same, only the label changes.
 */
export function ThemeToggle() {
  const theme = useAppearanceStore(s => s.theme)
  const index = MODES.findIndex(m => m.theme === theme)
  const { Icon, label } = MODES[index] ?? MODES[2]
  const next = MODES[(index + 1) % MODES.length] ?? MODES[0]
  return (
    <button
      type="button"
      onClick={e =>
        useAppearanceStore.getState().setTheme(next.theme, e.currentTarget.getBoundingClientRect())
      }
      aria-label={text.theme.toggle}
      className="flex h-9 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-[6px] border border-border px-3 text-left text-[13px] text-muted transition-colors hover:bg-default/60 hover:text-foreground motion-reduce:transition-none"
    >
      <Icon size={16} aria-hidden />
      {label}
    </button>
  )
}
