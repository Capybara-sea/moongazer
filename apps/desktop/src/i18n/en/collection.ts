// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** The collection pages' text: the overview of them, achievements and anecdotes. */

import type { Text } from "@/i18n"

const n = (value: number) => value.toLocaleString("en-US")
/** "1 day", "3 days"; `many` where adding "s" is wrong. */
const counted = (value: number, one: string, many = `${one}s`) =>
  `${n(value)} ${value === 1 ? one : many}`
const quoted = (name: string) => `"${name}"`

export const collection: Text["collection"] = {
  title: "Collection",
  back: "‹ Collection",
  hint: "Click a card to open it",
  percent: (done: number, total: number) => `${total > 0 ? Math.floor((done / total) * 100) : 0}%`,
  achievementsLeft: (primogems: number) => `${n(primogems)} Primogems left to earn`,
  anecdotesLine: (earned: string, total: number, days: string) =>
    `Anecdote Stamps ${earned} / ${n(total)} · ${days}`,
  newer: (count: number) =>
    `${counted(count, "entry", "entries")} from a newer game version. Update Moongazer to show ${count === 1 ? "it" : "them"}.`,
  furnishingLine: (primogems: number) => `${n(primogems)} Primogems left to claim from companions`,
  spincrystalLine: (placed: string, bag: number) => `Owned: ${placed} · In inventory: ${n(bag)}`,
}

export const furnishingPage: Text["furnishingPage"] = {
  title: "Furnishing Sets",
  summary: (total: number, indoor: number, outdoor: number) =>
    `${counted(total, "set")} (${n(indoor)} indoor, ${n(outdoor)} outdoor)`,
  views: { sets: "By set", characters: "By character", furnishings: "Furnishings needed" },
  viewLabel: "View",
  search: "Sets, characters, items",
  noBag:
    "This snapshot has no furnishing counts from the inventory, so completeness and missing furnishings are not shown. Log in to the game with auto sync on to read them.",
  placedNote: "Furnishings placed in the realm cannot be read and count as missing.",
  stats: "Statistics",
  learned: "Sets learned",
  learnedLine: "Set blueprints learned",
  whole: "Complete in inventory",
  wholeLine: (craftable: number) =>
    `${counted(craftable, "more set")} can be completed by crafting`,
  wholeMissing: "Inventory counts not read",
  primogems: "Companion Primogems left",
  primogemsLine: (claimed: number, total: number) => `Claimed ${n(claimed)} / ${n(total)}`,
  claimNeedNote:
    "Only sets with rewards left to claim are counted. When several sets need the same furnishing, the set that needs the most is counted (it can be taken down after claiming and used for the next set).",
  indoor: "Indoor",
  outdoor: "Outdoor",
  kinds: (kinds: number, pieces: number) =>
    `${counted(kinds, "type")}, ${counted(pieces, "piece")}`,
  notLearned: "Blueprint not learned",
  complete: "Complete",
  short: (kinds: number, pieces: number) =>
    `Missing ${counted(kinds, "type")}, ${counted(pieces, "piece")}`,
  shortHow: (buy: number, blueprint: number) =>
    [
      ...(buy > 0 ? [`${n(buy)} to buy`] : []),
      ...(blueprint > 0 ? [`${counted(blueprint, "blueprint")} not learned`] : []),
    ].join(" · ") || "All missing furnishings can be crafted",
  craftableKinds: (kinds: number) => `${counted(kinds, "type")} craftable`,
  claimable: (primogems: number) => `Primogems ×${n(primogems)}`,
  units: "Furnishings",
  columns: {
    item: "Furnishing",
    need: "Need",
    have: "Have",
    short: "Short",
    getting: "Source",
    usedBy: "Used in",
  },
  usedBy: (sets: string[]) =>
    sets.length > 3
      ? `${sets.slice(0, 3).join(", ")} and ${n(sets.length - 3)} more`
      : sets.join(", "),
  onlyShort: "Missing only",
  noneShort: "The inventory has every furnishing needed",
  noneFurnishings: "No matching furnishings",
  getting: { craft: "Craftable", blueprint: "Blueprint not learned", buy: "Purchase" } as Record<
    string,
    string
  >,
  recipe: (parts: string[]) => `Recipe: ${parts.join(", ")}`,
  sources: (sources: string[]) => sources.join(", "),
  materials: "Crafting materials",
  materialsWhole: "Crafting materials (whole set)",
  materialShort: (count: number) => `${n(count)} short`,
  noMaterials: "No missing furnishings to craft",
  characterClaimable: (count: number, primogems: number) =>
    `${counted(count, "claim")} left · Primogems ×${n(primogems)}`,
  none: "No matching sets",
  allClaimed: "No companion Primogems to claim (all claimed, or the characters are not owned yet)",
  notRead: "Furnishing sets were not read in this snapshot.",
}

export const spincrystalPage: Text["spincrystalPage"] = {
  title: "Spincrystals",
  summary: (total: number) => counted(total, "Spincrystal"),
  stats: "Statistics",
  had: "Obtained",
  placed: "Owned",
  placedLine: "Placed in the Serenitea Pot",
  bag: "In inventory",
  bagLine: "Can be played once placed in the Serenitea Pot",
  none: "Not owned",
  notPlacedRead: "Not read",
  realmNote:
    "This snapshot has no list of Spincrystals placed in the Serenitea Pot (the game does not send it while none are placed), so only the inventory is counted.",
  areas: "Regions",
  allAreas: "All",
  filters: { all: "All", placed: "Owned", bag: "In inventory", none: "Not owned" } as Record<
    string,
    string
  >,
  filterLabel: "Status",
  columns: { label: "No.", song: "Song title", hint: "Location", status: "Status" },
  status: { placed: "Owned", bag: "In inventory", none: "Not owned" } as Record<string, string>,
  noMatch: "No matching Spincrystals",
}

export const achievementPage: Text["achievementPage"] = {
  title: "Achievements",
  summary: (done: number, total: number, earned: number, primogems: number) =>
    `Completed ${n(done)} / ${n(total)} · Primogems earned ${n(earned)} / ${n(primogems)}`,
  todo: "Incomplete",
  todoValue: (count: number) => n(count),
  primogemsLeft: "Primogems left to earn",
  byState: "Completion",
  filters: { all: "All", done: "Completed", todo: "Incomplete" },
  search: "Search achievements",
  sort: "Sort",
  sorts: { game: "Default", recent: "Completion time" },
  hideHidden: "Exclude hidden",
  goals: "Categories",
  allGoals: "All categories",
  hidden: "Hidden",
  done: "Completed",
  notDone: "Not completed",
  primogems: (count: number) => `${count} Primogems`,
  quest: {
    world: "World Quest",
    archon: "Archon Quest",
    hangout: "Hangout",
    commission: "Commission",
  } as Record<string, string>,
  version: (version: string) => `Added in Version ${version}`,
  searchVideo: (title: string) => `Search YouTube for ${quoted(title)}`,
  searchKeyword: (title: string) => `Genshin Impact ${title}`,
  searchFailed: "Could not open the browser",
  none: "No matching achievements",
  notRead: "Achievements were not read in this snapshot.",
}

const GUIDE = "原神游逸旅闻"
const GUIDE_AUTHOR = "栖霆杨 (Qitingyang)"

export const anecdotePage: Text["anecdotePage"] = {
  title: "Travelers' Tales",
  named: (character: string, title: string) => `${character}: ${title}`,
  summary: (total: number, hidden: number) => `${counted(total, "anecdote")} (${n(hidden)} hidden)`,
  hasLauma: "Lauma owned",
  noLauma: "Lauma not owned",
  lastWish: (at: string) => `Last wish ${at}`,
  laumaChip: { yes: "Has Lauma", no: "No Lauma" },
  laumaTip: { yes: "Click to see the difference", no: "Click to see the difference" },
  laumaTitle: "With or without Lauma",
  laumaLabel: (chip: string) => `${chip}: with or without Lauma`,
  laumaAuto: "Determined automatically from the account's characters; nothing to choose.",
  laumaWith: (total: number, choice: string, farewell: string, seals: number) =>
    `With Lauma: ${counted(total, "anecdote")}. ${quoted(farewell)} appears after ${quoted(choice)} is completed once (${counted(seals, "Stamp")}).`,
  laumaWithout: (total: number, choice: string, farewell: string, days: number) =>
    `Without Lauma: ${counted(total, "anecdote")}. ${quoted(farewell)} does not appear; ${quoted(choice)} must be completed on ${n(days)} consecutive days, 1 Stamp per day.`,
  laumaSeals: (withHer: number, without: number) =>
    `So the Stamp totals differ: ${n(withHer)} with Lauma, ${n(without)} without.`,
  onlyTodo: "Incomplete only",
  onlyHidden: "Hidden only",
  search: "Search anecdotes",
  full: (seals: number, primogems: number) =>
    `${seals} Anecdote Stamps collected. Claim the reward (${primogems} Primogems) in the game first; no new anecdotes appear until then.`,
  stats: "Statistics",
  done: "Completed",
  doneLine: (waiting: number, unmet: number) =>
    `${n(waiting)} pending · ${n(unmet)} not encountered`,
  seals: "Anecdote Stamps",
  sealsLine: (progress: number, target: number, primogems: number) =>
    `Next reward ${progress} / ${target} (Primogems ×${primogems})`,
  sealsFull: (progress: number, target: number) =>
    `Next reward ${progress} / ${target} · Ready to claim`,
  sealsNotRead: "Next reward progress not read",
  fastest: "Fastest finish",
  fastestValue: (days: number) => `About ${counted(days, "day")}`,
  fastestDone: "All completed",
  fastestLine: (hidden: number, normal: number) =>
    `Remaining: ${n(hidden)} hidden · ${n(normal)} regular`,
  fastestShort: (days: number) =>
    days > 0 ? `Fastest: about ${counted(days, "day")}` : "All completed",
  how: "How it is calculated",
  howTitle: "How it is calculated",
  howTotal: (total: number, hidden: number, withoutLauma: number, farewell: string, has: boolean) =>
    `Total: ${counted(total, "anecdote")} (${n(hidden)} hidden). Without Lauma, ${quoted(farewell)} does not appear, so ${n(withoutLauma)} are counted. This account ${has ? "has" : "does not have"} Lauma (determined from the account's characters).`,
  howSeals: (
    daily: string,
    then: string,
    total: number,
    choice: string,
    farewell: string,
    seals: number,
    days: number,
    withHer: number,
    without: number,
    reward: number,
    primogems: number,
  ) =>
    `Stamps: 1 per anecdote, with two exceptions. ${quoted(daily)} gives 1 for each day completed, and ${quoted(then)} brings the pair to ${total}; with Lauma, ${quoted(choice)} gives 1 and ${quoted(farewell)} gives ${seals}, while without her ${quoted(choice)} must be completed on ${n(days)} days, 1 per day. So there are ${n(withHer)} in all with Lauma and ${n(without)} without. The number earned is taken from the game (every ${reward} Stamps can be exchanged for ${primogems} Primogems).`,
  howFastest: (
    hidden: number,
    normal: number,
    perDay: number,
    normalDays: number,
    chain: string | undefined,
    chainDays: number,
    days: number,
  ) => {
    const parts = [
      `Fastest: ${counted(hidden, "hidden anecdote")}, at most 1 per day → ${counted(hidden, "day")}`,
      `${counted(normal, "regular completion")} at ${perDay} per day → ${counted(normalDays, "day")}`,
      ...(chain ? [`${chain} → at least ${counted(chainDays, "day")}`] : []),
    ]
    return `${parts.join("; ")}. The longest of these: about ${counted(days, "day")}.`
  },
  chain: (names: string[]) => names.map(quoted).join(" → "),
  howNote:
    "Regular anecdotes refresh 0–5 a day and are often taken up by story quests; hidden ones trigger by chance, cannot be wished for, and need their actions done first, so it usually takes longer.",
  areas: "Regions",
  allAreas: "All",
  characters: "Characters",
  allCharacters: (left: number) =>
    left > 0 ? `All characters · ${n(left)} left` : "All characters",
  gridNote: (others: number, all: number) =>
    `${counted(others, "more character")} done (clear "Incomplete only" to show all ${n(all)})`,
  gridAll: (all: number) => `${counted(all, "character")}, newest first`,
  allDone: "All completed",
  areaList: (names: string[]) => names.join(", "),
  sectionInfo: (count: number, done: number, areas: string) =>
    `${counted(count, "anecdote")} · ${n(done)} completed · ${areas}`,
  entries: "Anecdotes",
  status: {
    recorded: "Recorded",
    waiting: "Pending",
    unmet: "Not encountered",
    absent: "Not counted",
  } as Record<string, string>,
  hidden: "Hidden",
  sealsTag: (seals: number) => `✦ ${seals}`,
  daily: "✦ 1/day",
  dailyDone: (days: number) => `${counted(days, "day")} so far`,
  pairTotal: (name: string, total: number) => `${total} in total with ${quoted(name)}`,
  repeatDays: (days: number, done: number) =>
    `Over ${n(days)} days · ${Math.min(done, days)}/${days}`,
  needsLauma: "Requires Lauma",
  absent: "Does not appear without Lauma; not counted in the total",
  hiddenLine: "Hidden anecdote: appears by chance, cannot be wished for, at most 1 per day",
  peek: "Show summary (spoilers)",
  unpeek: "Hide",
  after: (name: string) => `Appears after ${quoted(name)}`,
  time: { day: "Appears only during the day", night: "Appears only at night" } as Record<
    string,
    string
  >,
  trigger: (how: string) => `Trigger: ${how}; appears by chance`,
  place: (place: string) => `Location: ${place}`,
  tips: "Tips",
  needAnecdote: (name: string) => quoted(name),
  needCharacter: (name: string) => `Own ${name}`,
  needMet: (what: string) => `Prerequisite: ${what}`,
  needDone: "Done",
  needOpen: (what: string) =>
    `Prerequisite: ${what} (not completed), so this anecdote will not appear yet`,
  needMissing: (what: string) =>
    `Prerequisite: ${what} (not met), so this anecdote will not appear yet`,
  needUnknown: (what: string) => `Prerequisite: ${what} (cannot be determined from this snapshot)`,
  unsure: (what: string) => `Unconfirmed: ${what}`,
  video: "Video guide",
  videoLabel: (title: string) => `Search YouTube for videos on ${quoted(title)}`,
  videoKeyword: (title: string) => `Genshin Impact Travelers' Tales ${title}`,
  source: `Each anecdote's location and prerequisites, and how hidden anecdotes trigger, are based on the guide ${quoted(GUIDE)} by Bilibili creator ${GUIDE_AUTHOR}`,
  openSource: "Open",
  openSourceLabel: `Open ${quoted(GUIDE)} in the browser`,
  openFailed: "Could not open the browser",
  none: "All completed",
  noMatch: "No matching anecdotes",
  notRead: "Travelers' Tales were not read in this snapshot.",
}
