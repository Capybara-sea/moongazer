// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import logoSvg from "@logo/logo.svg?raw"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import { wireLogoMotion } from "./logoMotion"
import { useScopedSvg } from "./scopeSvg"
import "./brand.css"

/**
 * The full logo, inline, with an intro of about 3.3 s each time it is shown:
 * on the sky and the sea, the moon rises out of the sea and its halo glows
 * up, the water catches its light, the mist drifts in, the arcs open one after
 * the other, and the stars spin in, twinkle and settle. The fades are in
 * brand.css, the movement in logoMotion.ts. Decorative.
 */
export function AnimatedLogo({ className }: { className?: string }) {
  const svg = useScopedSvg(logoSvg)
  const ref = useRef<HTMLSpanElement>(null)
  // A layout effect, so the listeners are there before the first animationstart.
  useLayoutEffect(() => (ref.current ? wireLogoMotion(ref.current) : undefined), [])
  return (
    <span
      ref={ref}
      aria-hidden
      className={cn("brand-logo", className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: our own bundled SVG, not user input
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/**
 * The logo drawn once, almost invisible, for the first frames after the app
 * starts. The first drawing of its filters compiles GPU shaders; while the
 * WebView's shader cache was still empty, that froze the window for most of a
 * second on the first visit to About. A transparent or off-screen copy is not
 * drawn at all, so this one is faint, on screen, and the size About shows.
 */
export function LogoWarmUp() {
  const svg = useScopedSvg(logoSvg)
  const [shown, setShown] = useState(true)
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setShown(false))
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  if (!shown) return null
  return (
    <span
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 size-32 opacity-[0.01] *:size-full"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: our own bundled SVG, not user input
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
