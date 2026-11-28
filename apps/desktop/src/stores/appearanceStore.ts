// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { create } from "zustand"
import { LANG_KEY, type Lang, lang } from "@/i18n"
import { setCloseQuits } from "@/lib/backend"
import { type NumberStyle, setNumberStyle } from "@/lib/format"
import { revealFrom } from "@/lib/motion"
import { readStored, writeStored } from "@/lib/storage"

/**
 * Theme, glass and motion, applied to <html>. public/theme.js applies the
 * same saved values before the first paint, so the two must read the same
 * keys the same way. Whether UIDs start masked, how large numbers are
 * written, the language and what closing the window does are kept here
 * too; they change nothing on
 * <html>. The theme keeps HeroUI's "heroui-theme" key so earlier choices
 * carry over; one store instead of HeroUI's useTheme lets the side
 * menu and the settings page share it.
 */

export type ThemeMode = "light" | "dark" | "system"

const THEME_KEY = "heroui-theme"
const GLASS_KEY = "moongazer:ui:glass"
const MOTION_KEY = "moongazer:ui:motion"
const MASK_UID_KEY = "moongazer:ui:maskUid"
const NUMBERS_KEY = "moongazer:ui:numbers"
const CLOSE_QUITS_KEY = "moongazer:ui:closeQuits"

type AppearanceState = {
  theme: ThemeMode
  glass: boolean
  motion: boolean
  maskUid: boolean
  /** Always K, M and B in English; the saved choice applies in Chinese. */
  numbers: NumberStyle
  /** Closing the window quits; by default it keeps running in the tray. */
  closeQuits: boolean
  /** A new look spreads from `from`, a control's bounding box, when given. */
  setTheme: (theme: ThemeMode, from?: DOMRect) => void
  setGlass: (on: boolean) => void
  setMotion: (on: boolean) => void
  setMaskUid: (on: boolean) => void
  setNumbers: (style: NumberStyle) => void
  setCloseQuits: (on: boolean) => void
  /** Saves the language and reloads the page in it. */
  setLanguage: (lang: Lang) => void
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
  // Shown unless set to masked.
  maskUid: readStored(MASK_UID_KEY) === "on",
  // K, M and B in English or when set; the Chinese units otherwise.
  numbers: lang === "en" || readStored(NUMBERS_KEY) === "kmb" ? "kmb" : "wan",
  closeQuits: readStored(CLOSE_QUITS_KEY) === "on",

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

  setMaskUid(on) {
    writeStored(MASK_UID_KEY, on ? "on" : "off")
    set({ maskUid: on })
  },

  setNumbers(style) {
    writeStored(NUMBERS_KEY, style)
    setNumberStyle(style)
    set({ numbers: style })
  },

  setCloseQuits(on) {
    writeStored(CLOSE_QUITS_KEY, on ? "on" : "off")
    set({ closeQuits: on })
    tellCloseQuits(on)
  },

  setLanguage(picked) {
    if (picked === lang) return
    writeStored(LANG_KEY, picked)
    location.reload()
  },
}))

// public/theme.js has applied these already, unless storage failed there.
{
  const { theme, glass, motion, numbers, closeQuits } = useAppearanceStore.getState()
  applyTheme(theme)
  applyGlass(glass)
  applyMotion(motion)
  setNumberStyle(numbers)
  tellCloseQuits(closeQuits)
}

function tellCloseQuits(on: boolean) {
  setCloseQuits(on).catch(() => {
    // Outside the app window there is no Rust side to tell.
  })
}

darkScheme.addEventListener("change", () => {
  const { theme } = useAppearanceStore.getState()
  if (theme === "system") applyTheme(theme)
})
