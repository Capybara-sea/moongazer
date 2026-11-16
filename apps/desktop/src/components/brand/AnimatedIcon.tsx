// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import iconSvg from "@logo/icon.svg?raw"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import { wireIconMotion } from "./logoMotion"
import { useScopedSvg } from "./scopeSvg"
import "./brand.css"

/**
 * The app icon, inline, with a short intro: the moon shows up and the star
 * turns in. While busy the star turns and twinkles, the moon fades out and back
 * in, and the discs behind it shimmer. When busy ends, the loops run to the end
 * of the current cycle, where they are back at the static icon, and stop. The
 * fades are in brand.css, the turns in logoMotion.ts. Decorative.
 */
export function AnimatedIcon({ busy = false, className }: { busy?: boolean; className?: string }) {
  const svg = useScopedSvg(iconSvg)
  const ref = useRef<HTMLSpanElement>(null)
  const [looping, setLooping] = useState(busy)
  if (busy && !looping) setLooping(true)
  // A layout effect, so the listeners are there before the first animationstart.
  useLayoutEffect(() => (ref.current ? wireIconMotion(ref.current) : undefined), [])

  // With motion off no loop runs whose end could clear the busy class, and
  // hiding the page cancels the loops, so clear it in those cases too.
  useEffect(() => {
    const el = ref.current
    if (!el || busy || !looping) return
    if (el.getAnimations?.({ subtree: true }).length === 0) {
      setLooping(false)
      return
    }
    const stop = () => setLooping(false)
    el.addEventListener("animationcancel", stop)
    return () => el.removeEventListener("animationcancel", stop)
  }, [busy, looping])

  return (
    <span
      ref={ref}
      aria-hidden
      className={cn("brand-icon", looping && "is-busy", className)}
      onAnimationIteration={() => {
        if (!busy) setLooping(false)
      }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: our own bundled SVG, not user input
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
