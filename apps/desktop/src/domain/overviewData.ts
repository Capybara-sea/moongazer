// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Game data the overview needs beyond names, from the table `cargo xtask
 * gen-data` builds: profile pictures and frames, name cards, season ends and
 * line-ups, Abyss blessings, exploration totals, Realm Currency rates and the
 * hand-written city and offering names. Times are unix seconds there and
 * milliseconds here.
 */

import data from "@/generated/overview.json"
import { text } from "@/text/zh"
import { type Element, isElement } from "./elements"

export type AbyssBlessing = { name: string; text: string }

type Table = {
  profilePictures: Record<string, string>
  profileFrames: Record<string, string>
  nameCards: Record<string, string>
  theater: Record<string, number>
  theaterCasts: Record<string, { elements: string[]; guests: string[]; openers: string[] }>
  stygian: Record<string, number>
  stygianBegins: Record<string, number>
  abyss: Record<string, number>
  abyssBlessings: Record<string, AbyssBlessing>
  areas: Record<string, { total: number; city: number }>
  cities: Record<string, { name: string; offerings: number[] }>
  offerings: Record<string, string>
  theaterLevels: Record<string, string>
  realmRates: { comfort: number; perHour: number }[]
}

const table: Table = data

const toMs = (seconds: number | undefined) => (seconds === undefined ? undefined : seconds * 1000)

export function profilePictureIcon(id: number) {
  return table.profilePictures[String(id)]
}

/** The ring around the profile picture; none for the default frame, which no icon host has. */
export function profileFrameIcon(id: number) {
  return table.profileFrames[String(id)]
}

/** A name card's wide art. */
export function nameCardPicture(id: number) {
  return table.nameCards[String(id)]
}

export function theaterEnd(season: number) {
  return toMs(table.theater[String(season)])
}

/** Character keys: the guests are the four special guest stars, the openers the opening cast. */
export type TheaterCast = { elements: Element[]; guests: string[]; openers: string[] }

export function theaterCast(season: number): TheaterCast | undefined {
  const cast = table.theaterCasts[String(season)]
  return cast && { ...cast, elements: cast.elements.filter(isElement) }
}

/** The blessing of the Abyss period that opened at `start`, the export's `tasks.abyss.start`. */
export function abyssBlessing(start: number): AbyssBlessing | undefined {
  const period = Object.keys(table.abyss).find(season => abyssStart(Number(season)) === start)
  return period === undefined ? undefined : table.abyssBlessings[period]
}

export type StygianSeason = { season: number; begin?: number; end: number }

/** Stygian Onslaught seasons with their begins and ends. */
export const STYGIAN_SEASONS: StygianSeason[] = Object.entries(table.stygian).map(
  ([season, end]) => ({
    season: Number(season),
    begin: toMs(table.stygianBegins[season]),
    end: end * 1000,
  }),
)

/** When a Spiral Abyss period opened. */
export function abyssStart(season: number) {
  return toMs(table.abyss[String(season)])
}

/** The Realm Currency an hour at `comfort` Adeptal Energy: that of the highest level it reaches. */
export function realmRate(comfort: number) {
  return table.realmRates.findLast(level => comfort >= level.comfort)?.perHour
}

export function theaterLevelName(level: number) {
  return table.theaterLevels[String(level)]
}

export type City = { id: number; name: string; offerings: { id: number; name: string }[] }

/** The cities with a Statue of The Seven, in game order. */
export const CITIES: City[] = Object.entries(table.cities)
  .map(([id, city]) => ({
    id: Number(id),
    name: city.name,
    offerings: city.offerings.map(offering => ({
      id: offering,
      name: table.offerings[String(offering)] ?? text.names.unknown(String(offering)),
    })),
  }))
  .sort((a, b) => a.id - b.id)

/**
 * A city's exploration as a fraction: the points of its areas, each capped
 * at the area's total, over the sum of those totals. Most areas report more
 * points than their total, so the cap and the weighting are estimates. Null
 * when none of the city's areas has points.
 */
export function cityExploration(city: number, explore: ReadonlyMap<number, number>) {
  let done = 0
  let total = 0
  let seen = false
  for (const [id, area] of Object.entries(table.areas)) {
    if (area.city !== city) continue
    const points = explore.get(Number(id))
    if (points !== undefined) seen = true
    done += Math.min(points ?? 0, area.total)
    total += area.total
  }
  return seen && total > 0 ? done / total : null
}
