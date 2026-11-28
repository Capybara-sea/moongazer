// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Names of game items by GOOD key, from the table `cargo xtask gen-data`
 * builds before every frontend build.
 */

import { names } from "@/domain/gameData"
import { text } from "@/text"
import { type Element, isElement, isWeaponType, type WeaponType } from "./elements"

export const NAME_KINDS = ["characters", "weapons", "artifactSets", "materials"] as const
export type NameKind = (typeof NAME_KINDS)[number]

type Entry = { name: string; icon?: string }

const tables: Record<NameKind, Record<string, Entry>> = names

/** The keys the bundled data has no name for: it predates those items. */
export function unnamed(kind: NameKind, keys: readonly string[]) {
  return keys.filter(key => !Object.hasOwn(tables[kind], key))
}

/** The twins' portraits by character id. */
const TWIN_ICONS = new Map([
  [10000005, "UI_AvatarIcon_PlayerBoy"],
  [10000007, "UI_AvatarIcon_PlayerGirl"],
])
let travelerIcon: string | undefined

/**
 * Which twin the shown account's Traveler is, by character id, for every Traveler's icon; none
 * when its snapshot does not say, as only Moongazer's own sync writes it.
 */
export function setTraveler(twin: number | undefined) {
  travelerIcon = twin === undefined ? undefined : TWIN_ICONS.get(twin)
}

/**
 * The name and icon of an item. Keys the bundled data lacks show as "data not
 * updated (key)". Weapons and artifacts name any Traveler just "Traveler".
 * A Traveler's icon is the twin's that `setTraveler` was given, if any.
 */
export function lookup(kind: NameKind, key: string): Entry {
  if (kind === "characters" && key === "Traveler") {
    return { name: text.names.traveler, icon: travelerIcon }
  }
  const entry = Object.hasOwn(tables[kind], key)
    ? (tables[kind][key] ?? { name: key })
    : { name: text.names.unknown(key) }
  return kind === "characters" && key.startsWith("Traveler") && travelerIcon
    ? { ...entry, icon: travelerIcon }
    : entry
}

export type CharacterData = {
  name: string
  icon?: string
  /** Unknown for keys newer than the bundled data. */
  rarity?: number
  /** The Manekins have none. */
  element?: Element
  weapon?: WeaponType
}

/** `text` is the effect. */
export type Constellation = { name: string; icon: string; text: string }
/** A talent's name, icon and description. */
export type Talent = { name: string; icon: string; text: string }
/** `ascension` is the phase that unlocks it, 0 for none. */
export type PassiveTalent = Talent & { ascension: number }

const characters: Record<
  string,
  {
    rarity: number
    element?: string
    weapon: string
    constellations?: readonly Constellation[]
    talents?: { auto: Talent; skill: Talent; burst: Talent }
    passives?: readonly PassiveTalent[]
    profile?: Profile
  }
> = names.characters

/** The title under a character's name, what their Vision is called and their constellation. */
export type Profile = { title: string; vision: string; constellation: string }

/** A character's profile; none for keys newer than the bundled data. */
export function characterProfile(key: string): Profile | undefined {
  return Object.hasOwn(characters, key) ? characters[key]?.profile : undefined
}

/** A character's name, icon, rarity, element and weapon type. */
export function characterData(key: string): CharacterData {
  const entry = Object.hasOwn(characters, key) ? characters[key] : undefined
  return {
    ...lookup("characters", key),
    rarity: entry?.rarity,
    element: isElement(entry?.element) ? entry.element : undefined,
    weapon: isWeaponType(entry?.weapon) ? entry.weapon : undefined,
  }
}

/** A character's six constellations in order; none for the Manekins and for newer keys. */
export function constellations(key: string): readonly Constellation[] {
  return Object.hasOwn(characters, key) ? (characters[key]?.constellations ?? []) : []
}

/**
 * A character's normal attack, elemental skill and burst, and passive talents in the game's order;
 * none for the Manekins and for newer keys.
 */
export function characterTalents(key: string) {
  const entry = Object.hasOwn(characters, key) ? characters[key] : undefined
  return { talents: entry?.talents, passives: entry?.passives ?? [] }
}

type Passive = { name: string; parts: readonly string[][]; values: readonly string[][] }

const weapons: Record<string, { rarity: number; type: string; flavor: string; passive?: Passive }> =
  names.weapons

/** A weapon's name, icon, rarity, type and the game's short description of it. */
export function weaponData(key: string) {
  const entry = Object.hasOwn(weapons, key) ? weapons[key] : undefined
  return {
    ...lookup("weapons", key),
    rarity: entry?.rarity,
    type: isWeaponType(entry?.type) ? entry.type : undefined,
    flavor: entry?.flavor,
  }
}

export type PassiveSegment = {
  text: string
  highlight: boolean
  /**
   * A highlighted value at every refinement, when they differ; `current` is
   * the place of `text` among them.
   */
  byRefinement?: { values: readonly string[]; current: number }
}
export type WeaponPassive = { name: string; segments: PassiveSegment[] }

/**
 * A weapon's passive at a refinement, its values marked for highlighting as the game does. None
 * for the lowest-rarity weapons and for newer keys. Weapons that cannot be refined have one text.
 */
export function weaponPassive(key: string, refinement: number): WeaponPassive | undefined {
  const passive = Object.hasOwn(weapons, key) ? weapons[key]?.passive : undefined
  if (!passive) return undefined
  const at = Math.min(Math.max(refinement, 1), passive.values.length) - 1
  const values = passive.values[at] ?? []
  // Values line up across refinements only when the wording is shared.
  const shared = passive.parts.length === 1
  const segments = (passive.parts[at] ?? passive.parts[0] ?? []).flatMap((part, i) => {
    const all = shared ? passive.values.map(row => row[i] ?? "") : []
    const differ = all.some(value => value !== all[0])
    const value: PassiveSegment = { text: values[i] ?? "", highlight: true }
    if (differ) value.byRefinement = { values: all, current: at }
    return [{ text: part, highlight: false }, value]
  })
  return { name: passive.name, segments: segments.filter(segment => segment.text !== "") }
}

export type SetEffect = { need: number; text: string }

const artifactSets: Record<string, { effects: readonly SetEffect[] }> = names.artifactSets

/** An artifact set's effects, fewest pieces first; none for keys newer than the bundled data. */
export function setEffects(key: string): readonly SetEffect[] {
  return Object.hasOwn(artifactSets, key) ? (artifactSets[key]?.effects ?? []) : []
}

/** The materials page's tabs, in its order. */
export const MATERIAL_TABS = [
  "develop",
  "currency",
  "specialty",
  "food",
  "material",
  "item",
  "other",
] as const
export type MaterialTab = (typeof MATERIAL_TABS)[number]

function isMaterialTab(value: unknown): value is MaterialTab {
  return MATERIAL_TABS.some(tab => tab === value)
}

export type MaterialData = {
  name: string
  icon?: string
  /** Unknown for keys newer than the bundled data. */
  rarity?: number
  /** The game's own category, such as weapon ascension material; some items have none. */
  type?: string
  /** The type's name in Chinese whatever the UI's language, to keep in saved data. */
  typeId?: string
  /** The type's place on the materials page, tab after tab; none without a type. */
  typeOrder?: number
  /** Other for materials without a type. */
  tab: MaterialTab
}

const materials: Record<string, { rarity: number; type?: number }> = names.materials
/** In the materials page's order, each with its tab. */
const materialTypes: readonly { id: string; name: string; tab: string }[] = names.materialTypes
const typeNames = new Map(materialTypes.map(type => [type.id, type.name]))

/** A material type's name in the UI's language, by its id; the id when the data has no such type. */
export function materialTypeName(id: string) {
  return typeNames.get(id) ?? id
}

/** A material's name, icon, rarity, type and tab. */
export function materialData(key: string): MaterialData {
  const entry = Object.hasOwn(materials, key) ? materials[key] : undefined
  const type = entry?.type === undefined ? undefined : materialTypes[entry.type]
  return {
    ...lookup("materials", key),
    rarity: entry?.rarity,
    type: type?.name,
    typeId: type?.id,
    typeOrder: type ? entry?.type : undefined,
    tab: isMaterialTab(type?.tab) ? type.tab : "other",
  }
}
