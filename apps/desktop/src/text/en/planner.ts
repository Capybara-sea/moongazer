// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** The planner page's text. */

import type { Text } from "@/text"

const n = (value: number) => value.toLocaleString("en-US")
/** "1 ascension", "3 ascensions". */
const counted = (value: number, one: string, many = `${one}s`) =>
  `${n(value)} ${value === 1 ? one : many}`
/** Indexed Monday to Sunday, as the zh list; also the weekday grid's heads. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const GROUP_DAYS = ["Mon/Thu", "Tue/Fri", "Wed/Sat"]
const LIST = ", "
const RECIPE_KINDS = { combine: "Craft", convert: "Convert" }
/** `afterRecipes` gets the kinds as labels, joined by `LIST`; it says them as verbs. */
const DOING: Record<string, string> = {
  [RECIPE_KINDS.combine]: "crafting",
  [RECIPE_KINDS.convert]: "converting",
}

export const planner: Text["planner"] = {
  title: "Planner",
  subtitle: (time: string, goals: number, off: number) =>
    `Inventory: ${time} · ${counted(goals, "goal")}${off > 0 ? ` (${n(off)} disabled)` : ""} · Plans are saved per account`,
  live: "Live",
  settings: "Settings",
  settingsLabel: "Planner settings",
  focusLabel: "Recommendation order",
  focus: { important: "By priority", ready: "By materials" },
  focusDetail: [
    "Talents are recommended only once the level reaches its goal.",
    "By priority: only talent ① is recommended, then ② once ① reaches its goal; if materials are short, it waits.",
    "By materials: any talent with enough materials for its next level is recommended, in ①②③ order.",
  ],
  newCharacter: "New character goals",
  newWeapon: "New weapon goals",
  defaultTalents: "Talents (by priority)",
  talentsRaiseLevel:
    "When talents need more ascensions than the level has, the level is raised to match. For example, talent level 9 needs 6 ascensions, so the level is raised to 80★.",
  lowWeaponCap: "1★ and 2★ weapons cap at Lv. 70",
  convertTitle: "Material conversion",
  convert: { gem: "Elemental gems", weekly: "Weekly boss materials" },
  convertLabel: (name: string) => `Convert ${name.charAt(0).toLowerCase()}${name.slice(1)}`,
  convertDetail: {
    gem: "When still short after crafting, spare gems of the same tier from other elements are converted to make up the rest, using Dust of Azoth.",
    weekly:
      "When short, spare materials from the same weekly boss are converted to make up the rest, using Dream Solvent.",
  },
  defaultsHint: "Applies only to goals added from now on; existing goals are unchanged.",
  addCharacter: "Add character",
  addWeapon: "Add weapon",
  noAccount: "Import or sync account data first",
  noAccountDetail: "Plans are saved per account, so the account's data must be read first.",
  noUid: "This snapshot has no UID",
  noUidDetail: "Plans are saved per UID; the planner is unavailable when the export has no UID.",
  loadFailed: "Failed to load the plan",
  saveFailed: "Failed to save the plan; recent changes are not saved",
  empty: "No goals",
  emptyDetail: 'Click "Add character" or "Add weapon" above.',
  tags: {
    unowned: "Not owned",
    otherElement: "Other element",
    missing: "Not in inventory",
    custom: "Custom",
  },
  otherElementTip:
    "The export only has the Traveler's talents for the current element; other elements' talents count as level 1.",
  off: "Disable",
  offLabel: (name: string) => `Disable ${name}`,
  remove: "Delete goal",
  removeLabel: (name: string) => `Delete goal: ${name}`,
  removeAsk: "Delete this goal? This cannot be undone.",
  removeYes: "Delete",
  cancel: "Cancel",
  expBoost: "Event weapon EXP ×1.5",
  expBoostTag: "EXP ×1.5",
  expBoostTip:
    "During the event this weapon gains 1.5× EXP: the ores needed are divided by 1.5, and the Mora for leveling drops to match.",
  moraHalved: (name: string) => `Ascension Mora halved by ${name}'s Passive Talent`,
  priorityHint:
    "Inventory materials are allotted in card order, earlier cards first. Drag cards to reorder.",
  dragHint: "Drag to reorder, or use the arrow keys",
  dragLabel: (name: string) => `${name}: drag to reorder, or use the arrow keys`,
  level: "Level",
  talents: { auto: "Attack", skill: "Skill", burst: "Burst" },
  rankLabel: (rank: number) => `Priority ${rank}`,
  rankedName: (name: string, rank: number) => `${name}, priority ${rank}`,
  // The row heads sit in a 32 px column.
  rows: { ascension: "Asc.", talents: "Talent" },
  stageTitle: (from: string, to: string, ascensions: number) =>
    ascensions > 0
      ? `Level ${from} → ${to}, ${counted(ascensions, "ascension")} needed`
      : `Level ${from} → ${to}`,
  talentTitle: (name: string, from: number, to: number) => `${name} ${from} → ${to}`,
  recipeKinds: RECIPE_KINDS,
  times: (count: string) => `×${count}`,
  // One-character badges on a material's icon: crafted up a tier, converted.
  combineMark: "↑",
  convertMark: "⇄",
  convertSpend: (count: string) => `Conversions use ${count}`,
  expEquivalent: {
    character: "Equivalent count of all EXP books combined",
    weapon: "Equivalent count of all Enhancement Ores combined",
  },
  inBag: (bag: string) => `${bag} in inventory`,
  sharedBag: (bag: string, taken: string) =>
    `${bag} in inventory, ${taken} allotted to earlier goals`,
  /** `by` is what made it up, as "Craft" or "Craft, Convert"; no `left` once it is enough. */
  afterRecipes: (by: string, left?: string) => {
    const doing = by
      .split(LIST)
      .map(kind => DOING[kind] ?? kind.toLowerCase())
      .join(" and ")
    return left === undefined ? `Enough after ${doing}` : `${left} more needed after ${doing}`
  },
  besideName: (amount: string) => ` (${amount})`,
  short: (count: string) => `−${count}`,
  neededBy: (names: readonly string[], total: number) =>
    `Needed by: ${names.join(LIST)}${total > names.length ? ` and ${n(total - names.length)} more` : ""}`,
  moraExp: "Mora & EXP",
  specialties: "Local Specialties",
  worldBoss: "World boss materials",
  weeklyBoss: "Weekly boss materials",
  status: {
    off: "Disabled",
    done: "Goal reached",
    complete: "Materials ready",
    ascend: "Ready to ascend",
    level: "Ready to level",
    talent: "Ready to level talents",
    short: (kinds: number) => `${counted(kinds, "material")} short`,
  },
  openToday: (what: string) => `${what} available today`,
  openOn: (what: string, group: number) => `${what}: ${GROUP_DAYS[group] ?? ""}`,
  books: "Talent books",
  daysUnknown: (what: string) => `${what}: days unknown`,
  unknownKinds: (kinds: number) => `${n(kinds)} unknown`,
  weaponMaterials: "Weapon materials",
  abundance: "All Domains are open during Overflowing Abundance. Refer to the game for details.",
  today: (weekday: number) => `Today · ${WEEKDAY_NAMES[weekday] ?? ""}`,
  weekdays: WEEKDAYS,
  todayHint: "Short materials from Domains open today",
  todayNone: "No short materials from Domains open today",
  sunday: "All Domains are open on Sunday",
  listSeparator: LIST,
  clauseSeparator: " · ",
  summary: "Summary",
  onlyShort: "Short only",
  summaryEmpty: "Materials ready",
  editLevel: "Level",
  editTalents: "Talents",
  editOrder: "Priority",
  editOrderHint: "Drag to reorder",
  resetOrder: "Reset",
  talentNeeds: (phase: number) => `Needs ${counted(phase, "ascension")}`,
  keep: "Keep current level",
  done: "Done",
  addTitle: { character: "Add character", weapon: "Add weapon" },
  addCustom: { character: "Custom character", weapon: "Custom weapon" },
  customName: { character: "New character", weapon: "New weapon" },
  replace: { character: "Replace with real character", weapon: "Replace with real weapon" },
  name: "Name",
  rarity: "Rarity",
  weaponType: "Weapon type",
  slots: {
    common: "Common material",
    specialty: "Local Specialty",
    boss: "Boss material",
    gem: "Elemental gem",
    book: "Talent book",
    weekly: "Weekly boss material",
  },
  weaponSlots: {
    weapon: "Weapon Ascension Material",
    elite: "Elite enemy drop",
    common: "Common enemy drop",
  },
  unknown: "Unknown",
  unknownSlot: (slot: string) => `${slot} (unknown)`,
  search: "Search by name",
  filters: {
    element: "Filter by element",
    rarity: "Filter by rarity",
    weapon: "Filter by weapon type",
  },
  all: "All",
  owned: "Owned",
  unowned: "Not owned",
  wielder: (name: string) => `Equipped by ${name}`,
  unequipped: "Unequipped",
  noMatch: "No matches",
  close: "Close",
}
