// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** The overview's to-do card and resin plan, and the planner's upgrade panel. */

import type { Text } from "@/text"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** "1 type", "3 types". */
const counted = (value: number, one: string, many = `${one}s`) =>
  `${value.toLocaleString("en-US")} ${value === 1 ? one : many}`

export const tasks: Text["tasks"] = {
  countdown: {
    days: (days: number, hours: number) => `${days}d ${hours}h`,
    hours: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
    minutes: (minutes: number) => `${minutes}m`,
  },
  todo: "To-do",
  tabsLabel: "Task categories",
  tabs: { all: "All", standing: "Regular", events: "Events", custom: "Custom" },
  hideDone: "Hide completed",
  shown: "Shown tasks",
  newTask: "New task",
  noUid:
    "This snapshot has no UID, so tasks cannot be checked manually and custom tasks cannot be added.",
  loadFailed: (error: string) => `Failed to load tasks: ${error}`,
  saveFailed: (error: string) => `Failed to save tasks; recent changes are not saved: ${error}`,
  empty: "No tasks",
  allDone: "All tasks completed",
  customEmpty: 'No custom tasks. Click "+" at the top right to add one.',
  auto: "Checked automatically from the snapshot",
  autoOff: "Automatic check is off; check manually",
  autoTip: "Checked automatically from the snapshot. Click to turn this off and check manually",
  autoOffTip: "Automatic check is off; check manually. Click to turn it back on",
  lockedTick:
    "Checked automatically from the snapshot. To check it manually, click the sync icon on the right",
  markLabel: (task: string, state: string) => `${task}: ${state}`,
  standing: {
    battlePass: "Battle Pass weekly missions",
    reputation: "Reputation",
    shop: "Paimon's Bargains",
    arRewards: "Adventure Rank Rewards",
  },
  detail: {
    count: (done: number, total: number) => `${done}/${total}`,
    fate: (name: string, bought: number, limit: number) => `${name} ${bought}/${limit}`,
    arRewards: (n: number) => (n > 0 ? `${n} to claim` : "None to claim"),
    separator: " · ",
  },
  eventUnnamed: (id: number) => `Event ${id}`,
  eventTags: { quest: "Quest", exploration: "Exploration" },
  groups: {
    limited: "Limited-time events",
    gcg: "Genius Invokation TCG",
    challenge: "Challenges",
    quest: "Quests and areas",
    trial: "Trial characters",
    banner: "Banners",
  },
  repeat: {
    daily: "Daily",
    weekly: "Weekly",
    days: (n: number) => (n === 1 ? "Every day" : `Every ${n} days`),
  },
  byDone: " (from completion)",
  startsOn: (month: number, day: number) => `Starts ${MONTHS[month - 1] ?? month} ${day}`,
  shownSections: { standing: "Regular", events: "Events", custom: "Custom" },
  shownLabel: (name: string) => `Show ${name}`,
  edit: (name: string) => `Edit ${name}`,
  noCustom: "No custom tasks",
  dialog: {
    newTitle: "New task",
    editTitle: "Edit task",
    name: "Name",
    repeat: "Repeat",
    repeats: { daily: "Daily", weekly: "Weekly", days: "Every N days" },
    days: "Interval in days",
    daysUnit: "days",
    startDay: "Start date",
    anchor: "Count from",
    anchors: { start: "Start date", done: "Completion" },
    anchorHint: {
      start: "Repeats on a fixed cycle from the start date.",
      done: "Comes back one cycle after it is completed.",
    },
    dayHint: (reset: string) => `Each day starts at the daily reset (${reset}).`,
    note: "Note",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    deleteAsk: "Delete this task? This cannot be undone.",
  },
}

export const resinPlan: Text["resinPlan"] = {
  title: "Resin plan",
  /** The header's note: the resin there is. */
  original: (value: number, cap: number) => `Original Resin ${value}/${cap}`,
  originalNotRead: "Original Resin: not read",
  item: (name: string, count: number) => `${name} ×${count}`,
  training: {
    title: "To Temper Thyself and Journey Far",
    value: (spent: number, goal: number) => `${spent} / ${goal}`,
    tip: "Original Resin spent today (Condensed Resin not counted)",
  },
  burst: {
    title: "Disturbance Outbreak",
    left: (time: string) => `${time} left`,
    modesLabel: "Resin use during the Disturbance Outbreak",
    modes: { all: "Artifacts", prestige: "Prestige" },
    /** Under the time left: what the chosen way means for the rows below. */
    notes: { all: "Items below can wait", prestige: "Goal 1,200, about 120 a day" },
    all: "All on Artifacts: after clearing a Stygian Onslaught battle on Hard or above, spend resin at Disturbance-affected Ley Line Blossoms to claim rewards from a Domain of Blessing of your choice. The items below can wait until the Outbreak ends.",
    prestige:
      "1,200 Dire Prestige first: spend 1,200 resin in total at Disturbance-affected Ley Line Blossoms (10 days in all, 120 a day on average) to claim the Dust of Enlightenment, and use the rest of the resin in the order below.",
  },
  places: {
    weekly: "Weekly bosses",
    domains: "Today's Domains",
    worldBoss: "World bosses",
    blossoms: "Ley Line Blossoms",
    free: "No resin needed",
    plan: "Planned materials",
  },
  weeklyLeft: (n: number) => `Half cost: ${n} left`,
  weeklyNone: "None left this week",
  short: (n: number) => `${n} short`,
  more: (n: string) => `+${n}`,
  tomorrow: (names: string) => `Open tomorrow: ${names}`,
  blossomParts: { exp: "Character EXP", mora: "Mora" },
  freeParts: {
    specialty: (n: number) => counted(n, "Local Specialty", "Local Specialties"),
    enemy: (n: number) => counted(n, "enemy drop"),
    weaponExp: "Weapon EXP (forging)",
  },
  enough: "All planned materials are covered",
  notToday: "The short materials cannot be farmed today or tomorrow",
  items: "Resin items",
  noPlan: "Add goals in the Planner to list short materials by location.",
  allOff: "All goals in the Planner are disabled.",
  openPlanner: "Go to Planner",
  planFailed: (error: string) =>
    error ? `Failed to load the plan: ${error}` : "Failed to load the plan",
}

export const upgrade: Text["upgrade"] = {
  title: "Ready to level",
  ascend: (from: string, to: string) => `Ascend ${from} → ${to}`,
  level: (from: string, to: string) => `Level ${from} → ${to}`,
  levelCap: (level: number, cap: number) => `${level}/${cap}`,
  recipeKinds: { combine: "Craft", convert: "Convert" },
  times: (count: string) => `×${count}`,
  /** Read out in place of the recipe's plus and arrow. */
  and: "and",
  makes: "makes",
  none: "No goals ready to level",
}
