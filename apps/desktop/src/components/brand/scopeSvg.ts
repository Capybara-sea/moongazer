// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { useId, useMemo } from "react"

/**
 * Prefixes every id in an SVG and every url(#..) and href="#.." that points at
 * one, so inline copies of the same SVG cannot pick up each other's gradients,
 * filters or clip paths.
 */
export function scopeSvgIds(svg: string, scope: string) {
  return svg.replace(/(\bid="|url\(#|href="#)/g, `$1${scope}-`)
}

/** The SVG with its ids scoped to the calling component. */
export function useScopedSvg(svg: string) {
  const scope = useId().replace(/[^\w-]/g, "")
  return useMemo(() => scopeSvgIds(svg, scope), [svg, scope])
}
