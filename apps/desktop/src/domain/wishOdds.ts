// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * How many wishes featured characters and weapons take, worked out exactly
 * (not simulated) from the public model of the game's rates:
 *
 * - Character event: 0.6% a wish, from the 74th 6% more each wish, the 90th
 *   certain. A five-star is the featured one half the time (the 50/50); a
 *   lost one makes the next certain. Capturing Radiance: after three 50/50s
 *   lost in a row the next is won; it never comes sooner.
 * - Weapon event: 0.7% a wish, from the 63rd 7% more each wish, the 80th
 *   certain. A five-star is one of the two featured weapons 75% of the time,
 *   the one on the Epitomized Path half of those; any other gives a Fate
 *   Point, and with one the next five-star is the chosen weapon.
 */

export type CharacterState = {
  /** Wishes since the last five-star. */
  pity: number
  /** The next five-star is the featured one. */
  guaranteed: boolean
  /** 50/50s lost in a row (Capturing Radiance's count), 0 to 3. */
  radiance: number
}

export type WeaponState = {
  pity: number
  /** The next five-star is one of the featured weapons. */
  guaranteed: boolean
  /** Epitomized Path's Fate Points, 0 or 1. */
  fate: number
}

/** When each copy arrives: `pmf[j][t]` is the chance the (j + 1)th comes with wish t. */
export type Arrivals = {
  pmf: Float64Array[]
  /** `cdf[j][t]`: the chance it came by wish t. */
  cdf: Float64Array[]
  /** The average wish it comes with. */
  mean: number[]
}

const RADIANCE_LIMIT = 3
/** What is left of the chance once its tail is this small. */
const DONE = 1e-10

function characterRate(wish: number) {
  return Math.min(1, wish <= 73 ? 0.006 : 0.006 + 0.06 * (wish - 73))
}

function weaponRate(wish: number) {
  return Math.min(1, wish <= 62 ? 0.007 : 0.007 + 0.07 * (wish - 62))
}

/** The chance a 50/50 is lost while fewer than three were lost in a row. */
export const LOSE = 0.5

/**
 * Steps a distribution over states wish by wish. `states` is the state
 * count; `step` moves the mass at one state through one wish, calling `stay`
 * for mass that stays without a copy and `arrive` for mass with one more.
 */
function arrivals(
  copies: number,
  states: number,
  start: number,
  step: (
    state: number,
    mass: number,
    stay: (state: number, mass: number) => void,
    arrive: (state: number, mass: number) => void,
  ) => void,
): Arrivals {
  const pmf: number[][] = Array.from({ length: copies }, () => [0])
  if (copies > 0) {
    // Mass by copy count, then by state.
    let now = new Float64Array(states * copies)
    now[start] = 1
    let left = 1
    for (let wish = 1; left > DONE; wish++) {
      const next = new Float64Array(states * copies)
      for (let got = 0; got < copies; got++) {
        for (let state = 0; state < states; state++) {
          const mass = now[got * states + state] ?? 0
          if (mass === 0) continue
          step(
            state,
            mass,
            (to, m) => {
              next[got * states + to] = (next[got * states + to] ?? 0) + m
            },
            (to, m) => {
              const list = pmf[got]
              if (list) list[wish] = (list[wish] ?? 0) + m
              if (got + 1 < copies) {
                next[(got + 1) * states + to] = (next[(got + 1) * states + to] ?? 0) + m
              } else {
                left -= m
              }
            },
          )
        }
      }
      now = next
    }
  }
  const dense = pmf.map(list => Float64Array.from(list, value => value ?? 0))
  return {
    pmf: dense,
    cdf: dense.map(list => {
      const cdf = new Float64Array(list.length)
      let sum = 0
      list.forEach((value, t) => {
        sum += value
        cdf[t] = sum
      })
      return cdf
    }),
    mean: dense.map(list => list.reduce((sum, value, t) => sum + value * t, 0)),
  }
}

const CHARACTER_PITY = 90
const WEAPON_PITY = 80

/** When each of `copies` featured characters arrives, from `state`. */
export function characterArrivals(state: CharacterState, copies: number): Arrivals {
  // State: pity (0-89), guaranteed (0-1), count (0-3).
  const index = (pity: number, guaranteed: number, count: number) =>
    (pity * 2 + guaranteed) * (RADIANCE_LIMIT + 1) + count
  const start = index(
    Math.min(Math.max(0, state.pity), CHARACTER_PITY - 1),
    state.guaranteed ? 1 : 0,
    Math.min(Math.max(0, state.radiance), RADIANCE_LIMIT),
  )
  return arrivals(
    copies,
    CHARACTER_PITY * 2 * (RADIANCE_LIMIT + 1),
    start,
    (s, m, stay, arrive) => {
      const count = s % (RADIANCE_LIMIT + 1)
      const guaranteed = Math.floor(s / (RADIANCE_LIMIT + 1)) % 2
      const pity = Math.floor(s / (2 * (RADIANCE_LIMIT + 1)))
      const rate = characterRate(pity + 1)
      if (rate < 1) stay(index(pity + 1, guaranteed, count), m * (1 - rate))
      const hit = m * rate
      if (guaranteed) arrive(index(0, 0, count), hit)
      else if (count >= RADIANCE_LIMIT) arrive(index(0, 0, 0), hit)
      else {
        arrive(index(0, 0, 0), hit * (1 - LOSE))
        stay(index(0, 1, count + 1), hit * LOSE)
      }
    },
  )
}

/** When each of `copies` of the weapon on the Epitomized Path arrives, from `state`. */
export function weaponArrivals(state: WeaponState, copies: number): Arrivals {
  // State: pity (0-79), guaranteed (0-1), fate (0-1).
  const index = (pity: number, guaranteed: number, fate: number) =>
    (pity * 2 + guaranteed) * 2 + fate
  const start = index(
    Math.min(Math.max(0, state.pity), WEAPON_PITY - 1),
    state.guaranteed ? 1 : 0,
    state.fate > 0 ? 1 : 0,
  )
  return arrivals(copies, WEAPON_PITY * 4, start, (s, m, stay, arrive) => {
    const fate = s % 2
    const guaranteed = Math.floor(s / 2) % 2
    const pity = Math.floor(s / 4)
    const rate = weaponRate(pity + 1)
    if (rate < 1) stay(index(pity + 1, guaranteed, fate), m * (1 - rate))
    const hit = m * rate
    if (fate) arrive(index(0, 0, 0), hit)
    else if (guaranteed) {
      arrive(index(0, 0, 0), hit / 2)
      stay(index(0, 0, 1), hit / 2)
    } else {
      arrive(index(0, 0, 0), hit * 0.375)
      stay(index(0, 0, 1), hit * 0.375)
      stay(index(0, 1, 1), hit * 0.25)
    }
  })
}

const at = (list: Float64Array | undefined, t: number) =>
  list === undefined ? 1 : t >= list.length ? 1 : t < 0 ? 0 : (list[t] ?? 0)

/**
 * The chance `characters` featured characters and `weapons` chosen weapons
 * all come within `budget` wishes, the two banners' wishes added up.
 */
export function chanceWithin(
  character: Arrivals,
  characters: number,
  weapon: Arrivals,
  weapons: number,
  budget: number,
): number {
  const w = weapons > 0 ? weapon.cdf[weapons - 1] : undefined
  if (characters === 0) return at(w, budget)
  const c = character.pmf[characters - 1]
  if (!c) return 0
  let chance = 0
  for (let t = 1; t < c.length && t <= budget; t++) chance += (c[t] ?? 0) * at(w, budget - t)
  return Math.min(1, chance)
}

/** The average wishes both take together. */
export function meanWishes(
  character: Arrivals,
  characters: number,
  weapon: Arrivals,
  weapons: number,
): number {
  return (
    (characters > 0 ? (character.mean[characters - 1] ?? 0) : 0) +
    (weapons > 0 ? (weapon.mean[weapons - 1] ?? 0) : 0)
  )
}

/** A strategy: which to get first, as fribbels' calculator orders them. */
export type Strategy = "weapon" | 0 | 1 | 2 | 3 | 4 | 5 | 6
export const STRATEGIES: readonly Strategy[] = ["weapon", 0, 1, 2, 3, 4, 5, 6]

/**
 * The steps of a strategy, each as copies of the character (1 is C0) and of
 * the weapon so far: "C k first" gets the character to C k, then the weapon
 * once, then the character to C6, then the weapon to R5.
 */
export function strategySteps(strategy: Strategy): { characters: number; weapons: number }[] {
  const steps: { characters: number; weapons: number }[] = []
  if (strategy === "weapon") {
    steps.push({ characters: 0, weapons: 1 })
    for (let c = 1; c <= 7; c++) steps.push({ characters: c, weapons: 1 })
  } else {
    for (let c = 1; c <= strategy + 1; c++) steps.push({ characters: c, weapons: 0 })
    steps.push({ characters: strategy + 1, weapons: 1 })
    for (let c = strategy + 2; c <= 7; c++) steps.push({ characters: c, weapons: 1 })
  }
  for (let w = 2; w <= 5; w++) steps.push({ characters: 7, weapons: w })
  return steps
}

/**
 * Fates the Masterless Starglitter from wishing gives back, a wish on a
 * character event banner on average: 13% are four-stars (28.4% of them
 * weapons, 2 Starglitter; characters 5 once at C6, else 2), 1.6% five-stars
 * (a featured one taken as new to the account, nothing; a standard one, the
 * share a lost 50/50 brings over time, again, 10). `maxed` is the share of
 * the account's four-star characters at C6. 5 Starglitter buy a fate.
 */
export function refundPerWish(maxed: number) {
  const four = 0.284 * 2 + 0.716 * (maxed * 5 + (1 - maxed) * 2)
  const won = 1 / (1 + LOSE + LOSE ** 2 + LOSE ** 3)
  const standard = (1 - won) / (2 - won)
  const starglitter = 0.13 * four + 0.016 * standard * 10
  return { starglitter, fates: starglitter / 5 }
}
