// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

// Applies the saved theme before the first paint, so a dark theme does not
// flash light while the app loads. It mirrors HeroUI's useTheme, which takes
// over once React mounts: the "heroui-theme" key holds "light", "dark" or
// "system", and "system" follows the OS. A classic script in public/ rather
// than an inline one, because the CSP allows only same-origin scripts.
try {
  const saved = localStorage.getItem("heroui-theme") ?? "system"
  const dark = matchMedia("(prefers-color-scheme: dark)").matches
  const theme = saved === "system" ? (dark ? "dark" : "light") : saved
  document.documentElement.classList.add(theme)
  document.documentElement.setAttribute("data-theme", theme)
} catch {
  // Without storage the page starts light and useTheme corrects it on mount.
}
