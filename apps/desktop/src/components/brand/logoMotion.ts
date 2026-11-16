// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/*
 * The moving part of the logo and icon animations, as SVG SMIL animations added
 * at run time. brand.css only fades: in Edge 157 a CSS transform animation
 * changes how the picture is drawn while it runs, so it jumps when it stops;
 * SMIL is drawn like the static picture and ends on it exactly (measured frame
 * by frame). Intro times are in ms from the start of the svg's own CSS fade-in,
 * loop times from the start of its CSS loop. Most motions share the begin and
 * duration of the same element's fade; the logo's moon and its halo rise first
 * and light up on the way (see brand.css).
 */

import { motionAllowed } from "@/lib/motion"

const NS = "http://www.w3.org/2000/svg"
const EASE_OUT = "0 0 0.58 1"
const EASE_IN_OUT = "0.42 0 0.58 1"
/** Slow out of the sea, slowing down again near the top. */
const RISE = "0.3 0 0.2 1"
/** Just under the sea line; the moon is clipped there until it rises above it. */
const HORIZON = 792
const MOON_DROP = 560

type Motion = {
  select: string
  /** shift moves shapes by their x geometry instead of a transform (see the mist note). */
  kind: "translate" | "scale" | "rotate" | "shift"
  from: string
  begin: number
  dur: number
  splines: string
  /** Repeats until removed, in step with a CSS loop of the same duration. */
  repeat?: true
}

/** Where each kind of motion ends: the static design. */
const REST: Record<Motion["kind"], string> = {
  translate: "0 0",
  scale: "1",
  rotate: "0",
  shift: "0",
}

const MOON_RISE = {
  kind: "translate",
  from: `0 ${MOON_DROP}`,
  begin: 450,
  dur: 1500,
  splines: RISE,
} as const

const SPARK = { dur: 900, splines: EASE_OUT } as const

const MOTION: Motion[] = [
  { select: ".mg-moon", ...MOON_RISE },
  // The halo rises with the moon, so it never waits at the top before the
  // moon arrives; it only lights up and widens once the moon is mostly out.
  { select: ".mg-halo", ...MOON_RISE },
  { select: ".mg-halo", kind: "scale", from: "0.85", begin: 1250, dur: 1100, splines: EASE_OUT },
  {
    select: ".mg-ring-a",
    kind: "scale",
    from: "0.96",
    begin: 1800,
    dur: 900,
    splines: EASE_IN_OUT,
  },
  {
    select: ".mg-ring-b",
    kind: "scale",
    from: "0.96",
    begin: 2050,
    dur: 900,
    splines: EASE_IN_OUT,
  },
  { select: ".mg-mist-l", kind: "shift", from: "-48", begin: 1500, dur: 1200, splines: EASE_OUT },
  { select: ".mg-mist-r", kind: "shift", from: "48", begin: 1700, dur: 1200, splines: EASE_OUT },
  {
    select: ".mg-wisp",
    kind: "translate",
    from: "-24 0",
    begin: 1900,
    dur: 1200,
    splines: EASE_OUT,
  },
  // The cross stars grow in and their rays make a quarter turn (see wrapRays).
  { select: ".mg-spark:nth-child(1)", kind: "scale", from: "0.5", begin: 2100, ...SPARK },
  { select: ".mg-spark:nth-child(1) path", kind: "rotate", from: "-90", begin: 2100, ...SPARK },
  { select: ".mg-spark:nth-child(2)", kind: "scale", from: "0.5", begin: 2400, ...SPARK },
  { select: ".mg-spark:nth-child(2) path", kind: "rotate", from: "-90", begin: 2400, ...SPARK },
]

/** The icon's star turns in once the moon shows up. */
const ICON_INTRO: Motion[] = [
  { select: ".mg-star", kind: "scale", from: "0.5", begin: 400, dur: 800, splines: EASE_OUT },
  { select: ".mg-star path", kind: "rotate", from: "-90", begin: 400, dur: 800, splines: EASE_OUT },
]

/** While busy the icon's star keeps turning, a quarter turn per loop cycle. */
const ICON_BUSY: Motion[] = [
  {
    select: ".mg-star path",
    kind: "rotate",
    from: "-90",
    begin: 0,
    dur: 1600,
    splines: "0 0 1 1",
    repeat: true,
  },
]

/** `group`: "intro" or "busy"; without it, all motion. */
function stop(svg: SVGSVGElement, group?: string) {
  const selector = group ? `[data-motion="${group}"]` : "[data-motion]"
  for (const animation of svg.querySelectorAll(selector)) animation.remove()
}

/** How far the CSS animation `name` on `target` already is, in ms. */
function lagOf(target: Element, name: string) {
  const css = target
    .getAnimations()
    .find(a => a instanceof CSSAnimation && a.animationName === name)
  const now = Number(document.timeline.currentTime)
  return now - Number(css?.startTime ?? now)
}

function start(svg: SVGSVGElement, motions: Motion[], group: string, lag: number) {
  stop(svg, group)
  for (const motion of motions) {
    for (const host of svg.querySelectorAll(motion.select)) {
      // The mist shapes share one #cloud filter, and a transform on any of
      // them changes how Chromium draws the whole filter, so the mist moves by
      // its geometry instead. Never give those shapes a transform.
      const targets: [Element, string][] =
        motion.kind === "shift"
          ? (host.tagName === "g" ? [...host.children] : [host]).map(shape => [
              shape,
              shape.tagName === "rect" ? "x" : "cx",
            ])
          : [[host, "transform"]]
      for (const [element, attribute] of targets) {
        const transform = attribute === "transform"
        const animation = document.createElementNS(NS, transform ? "animateTransform" : "animate")
        const attributes: Record<string, string> = {
          attributeName: attribute,
          from: motion.from,
          to: REST[motion.kind],
          dur: `${motion.dur}ms`,
          begin: "indefinite",
          additive: "sum",
          calcMode: "spline",
          keyTimes: "0;1",
          keySplines: motion.splines,
          fill: "remove",
          "data-motion": group,
        }
        if (transform) attributes.type = motion.kind
        if (motion.repeat) attributes.repeatCount = "indefinite"
        for (const [name, value] of Object.entries(attributes)) {
          animation.setAttribute(name, value)
        }
        element.append(animation)
        // A loop starts now instead of catching up its lag: Edge 157 does not
        // apply SMIL begun in the past while other SMIL in the svg ran in the
        // last frame, until its first repeat. It then trails its CSS loop by
        // the lag, about a frame.
        const begin = motion.repeat ? Math.max(0, motion.begin - lag) : motion.begin - lag
        if (animation instanceof SVGAnimationElement) animation.beginElementAt(begin / 1000)
      }
    }
  }
}

/**
 * Clips the moon at the sea line so it rises out of the sea; otherwise it shows
 * through the water while the whole logo is still fading in. The clip is on a
 * wrapper because on the moon itself it would move down with the moon. The
 * moon sits well above that line in the design, so the static logo is uncut.
 */
function clipMoon(svg: SVGSVGElement) {
  const moon = svg.querySelector(".mg-moon")
  const id = `${svg.querySelector("[id]")?.id ?? "logo"}-horizon`
  if (!moon || svg.getElementById(id)) return
  const clip = document.createElementNS(NS, "clipPath")
  clip.id = id
  const rect = document.createElementNS(NS, "rect")
  rect.setAttribute("width", "1024")
  rect.setAttribute("height", String(HORIZON))
  clip.append(rect)
  svg.querySelector("defs")?.append(clip)
  const wrapper = document.createElementNS(NS, "g")
  wrapper.setAttribute("clip-path", `url(#${id})`)
  moon.replaceWith(wrapper)
  wrapper.append(moon)
}

/**
 * Moves the filter (and the opacity, to keep the order filter then opacity) of
 * each cross star ray onto a wrapper, so the ray turns inside an upright
 * filter. Edge 157 draws a filtered shape under a turned transform softer, so
 * a turning filtered ray would sharpen with a jump when the turn ends. The ray
 * turned by 45° in the design is always drawn that way, so it keeps its filter.
 */
function wrapRays(svg: SVGSVGElement) {
  for (const ray of svg.querySelectorAll(
    ":is(.mg-spark, .mg-star) path[filter]:not([transform])",
  )) {
    const wrapper = document.createElementNS(NS, "g")
    for (const name of ["filter", "opacity"]) {
      const value = ray.getAttribute(name)
      if (value === null) continue
      wrapper.setAttribute(name, value)
      ray.removeAttribute(name)
    }
    ray.replaceWith(wrapper)
    wrapper.append(ray)
  }
}

/**
 * Runs `intro` each time the svg's own CSS fade-in starts (the page is hidden
 * with display:none and shown again, which restarts the CSS but not SMIL), and
 * `loop` each time the CSS loop named `loop.name` starts; when both run, their
 * turns add up. Drops the intro when the svg's fade is cancelled, and all of it
 * when the loop is cancelled (the intro is over by then, and its ended SMIL
 * would keep the loop's last turn drawn a frame longer), when the page is
 * hidden or when motion is turned off on the way. With motion off there is no
 * CSS, so no motion either.
 */
function wire(span: HTMLElement, intro: Motion[], loop?: { name: string; motions: Motion[] }) {
  const onStart = (event: AnimationEvent) => {
    const svg = span.firstElementChild
    const target = event.target
    if (!(svg instanceof SVGSVGElement) || !(target instanceof Element)) return
    // SMIL time only runs once the document has loaded; earlier, the motion
    // would start late, so the picture then only fades.
    if (document.readyState !== "complete") return
    const lag = lagOf(target, event.animationName)
    if (loop && event.animationName === loop.name) start(svg, loop.motions, "busy", lag)
    else if (target === svg) start(svg, intro, "intro", lag)
  }
  const onCancel = (event: AnimationEvent) => {
    const svg = span.firstElementChild
    if (!(svg instanceof SVGSVGElement)) return
    // The svg's own fade ends early; hiding the page or turning motion off
    // later only cancels the CSS of its parts.
    if (!motionAllowed() || !svg.checkVisibility()) stop(svg)
    else if (event.target === svg) stop(svg, "intro")
    else if (loop && event.animationName === loop.name) stop(svg)
  }
  span.addEventListener("animationstart", onStart)
  span.addEventListener("animationcancel", onCancel)
  return () => {
    span.removeEventListener("animationstart", onStart)
    span.removeEventListener("animationcancel", onCancel)
  }
}

export function wireLogoMotion(span: HTMLElement) {
  // Before any animation runs: moving shapes later would cancel their fades.
  const logo = span.firstElementChild
  if (logo instanceof SVGSVGElement) {
    clipMoon(logo)
    wrapRays(logo)
  }
  return wire(span, MOTION)
}

/** The busy loop is the star's CSS twinkle (see brand.css). */
export function wireIconMotion(span: HTMLElement) {
  const icon = span.firstElementChild
  if (icon instanceof SVGSVGElement) wrapRays(icon)
  return wire(span, ICON_INTRO, { name: "brand-twinkle", motions: ICON_BUSY })
}
