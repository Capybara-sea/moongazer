// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * False when the OS asks for reduced motion or data-reduce-motion="true" is
 * set on <html>, the one switch that turns all of the app's motion off (it is
 * HeroUI's attribute, so its motion-reduce: variants follow it too).
 */
export function motionAllowed() {
  return (
    document.documentElement.dataset.reduceMotion !== "true" &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/**
 * Runs `update` in a view transition in which the new look spreads from the
 * centre of `from` (a control's bounding box) as a soft-edged circle, like a
 * rising moon; the "reveal" styles are in index.css. `update` must change the
 * DOM before it returns, so React state updates go through flushSync. Without
 * the API, or when motion is off, `update` just runs.
 */
export function revealFrom(
  from: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
  update: () => void,
) {
  if (typeof document.startViewTransition !== "function" || !motionAllowed()) {
    update()
    return
  }
  const x = from.left + from.width / 2
  const y = from.top + from.height / 2
  // Distance to the farthest corner, where the circle has covered the window.
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const style = document.documentElement.style
  style.setProperty("--reveal-x", `${x}px`)
  style.setProperty("--reveal-y", `${y}px`)
  style.setProperty("--reveal-r", `${r}px`)
  document.startViewTransition({ update, types: ["reveal"] })
}
