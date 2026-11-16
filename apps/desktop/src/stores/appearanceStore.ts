// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import { revealFrom } from "@/lib/motion"
import { readStored, writeStored } from "@/lib/storage"

/**
 * Theme, glass and motion, applied to <html>. public/theme.js applies the
 * same saved values before the first paint, so the two must read the same
 * keys the same way. The theme keeps HeroUI's "heroui-theme" key so earlier
 * choices carry over; one store instead of HeroUI's useTheme lets the side
 * menu and the settings page share it.
 */

export type ThemeMode = "light" | "dark" | "system"

const THEME_KEY = "heroui-theme"
const GLASS_KEY = "moongazer:ui:glass"
const MOTION_KEY = "moongazer:ui:motion"

type AppearanceState = {
  theme: ThemeMode
  glass: boolean
  motion: boolean
  /** A new look spreads from `from`, a control's bounding box, when given. */
  setTheme: (theme: ThemeMode, from?: DOMRect) => void
  setGlass: (on: boolean) => void
  setMotion: (on: boolean) => void
}

function readTheme(): ThemeMode {
  const saved = readStored(THEME_KEY)
  return saved === "light" || saved === "dark" ? saved : "system"
}

const darkScheme = matchMedia("(prefers-color-scheme: dark)")

/** The look a mode stands for right now. */
export function looksOf(theme: ThemeMode) {
  if (theme !== "system") return theme
  return darkScheme.matches ? "dark" : "light"
}

function applyTheme(theme: ThemeMode) {
  const look = looksOf(theme)
  const root = document.documentElement
  root.classList.remove(look === "dark" ? "light" : "dark")
  root.classList.add(look)
  root.setAttribute("data-theme", look)
}

function applyGlass(on: boolean) {
  if (on) document.documentElement.removeAttribute("data-glass")
  else document.documentElement.setAttribute("data-glass", "off")
}

function applyMotion(on: boolean) {
  if (on) document.documentElement.removeAttribute("data-reduce-motion")
  else document.documentElement.setAttribute("data-reduce-motion", "true")
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  theme: readTheme(),
  glass: readStored(GLASS_KEY) !== "off",
  motion: readStored(MOTION_KEY) !== "off",

  setTheme(theme, from) {
    writeStored(THEME_KEY, theme)
    const changes = looksOf(theme) !== looksOf(get().theme)
    const update = () => {
      applyTheme(theme)
      set({ theme })
    }
    if (from && changes) revealFrom(from, update)
    else update()
  },

  setGlass(on) {
    writeStored(GLASS_KEY, on ? "on" : "off")
    applyGlass(on)
    set({ glass: on })
  },

  setMotion(on) {
    writeStored(MOTION_KEY, on ? "on" : "off")
    applyMotion(on)
    set({ motion: on })
  },
}))

// public/theme.js has applied these already, unless storage failed there.
{
  const { theme, glass, motion } = useAppearanceStore.getState()
  applyTheme(theme)
  applyGlass(glass)
  applyMotion(motion)
}

darkScheme.addEventListener("change", () => {
  const { theme } = useAppearanceStore.getState()
  if (theme === "system") applyTheme(theme)
})
