// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

// Applies the saved theme, glass and motion choices before the first paint,
// so the app never flashes the defaults while it loads. It mirrors
// src/stores/appearanceStore.ts, which takes over once React mounts:
// "heroui-theme" holds "light", "dark" or "system" (following the OS), and
// the other two keys hold "off" when turned off. A classic script in public/
// rather than an inline one, because the CSP allows only same-origin scripts.
try {
  const root = document.documentElement
  const saved = localStorage.getItem("heroui-theme")
  const dark = matchMedia("(prefers-color-scheme: dark)").matches
  const theme = saved === "light" || saved === "dark" ? saved : dark ? "dark" : "light"
  root.classList.add(theme)
  root.setAttribute("data-theme", theme)
  if (localStorage.getItem("moongazer:ui:glass") === "off") root.setAttribute("data-glass", "off")
  if (localStorage.getItem("moongazer:ui:motion") === "off") {
    root.setAttribute("data-reduce-motion", "true")
  }
} catch {
  // Without storage the store applies the defaults once React loads.
}
