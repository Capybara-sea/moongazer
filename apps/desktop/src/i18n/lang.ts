// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

export type Lang = "zh" | "en"

/** Each language by its own name, the same in either UI. */
export const LANG_NAMES: Record<Lang, string> = { zh: "简体中文", en: "English" }

/** Where the chosen language is kept; absent until one is chosen in the settings. */
export const LANG_KEY = "moongazer:lang"

function initial(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === "zh" || saved === "en") return saved
  } catch {
    // Storage can be unavailable; the system's language then decides.
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"
}

/**
 * The UI's language for this page load: the one chosen in the settings, or
 * Chinese on a Chinese system and English on any other. Changing it reloads
 * the page, so everything reads it once.
 */
export const lang: Lang = initial()
