// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Game } from "./agdItems.ts"
import { download } from "./download.ts"
import { anecdoteRules } from "./manual.ts"
import { list, num, plain, type Raw, str } from "./tables.ts"

type Pin = { repo: string; commit: string }

/** What an achievement's quest is: a world quest, an Archon Quest, a hangout or a commission. */
type QuestKind = "world" | "archon" | "hangout" | "commission"
type Achievement = {
  id: number
  goal: number
  title: string
  desc: string
  /** The count to reach; 1 for one-off ones. */
  target: number
  primogems: number
  hidden?: true
  /** The tier before it in a series. */
  previous?: number
  /** The game version that added it, from Snap.Metadata. */
  version?: string
  quest?: QuestKind
  /** How the game shows the count: only done or not, or in thousandths (seconds of gliding). */
  count?: "none" | "thousandths"
}
type Anecdote = {
  id: number
  area: number
  /** The character's GOOD key; its name where it is not a playable character. */
  character: string
  title: string
  summary: string
  /** The game's hint before it is met; hidden ones have none. */
  hint?: string
  hidden?: true
  /** The anecdote it comes after. */
  after?: number
  /** Only in the day, or only at night. */
  time?: "day" | "night"
}
export type Collection = {
  achievementGoals: { id: number; name: string }[]
  achievements: Achievement[]
  anecdoteAreas: Record<string, string>
  anecdotes: Anecdote[]
  /** Variant ids the export may use for a main entry: each pair of players meets only one. */
  anecdoteVariants: Record<string, number>
  /** Seals per reward and the primogems a reward gives. */
  anecdoteReward: { seals: number; primogems: number }
  anecdoteRules: typeof anecdoteRules
}

const PRIMOGEM = 201

/**
 * The anecdote table's fields have obfuscated names that change between game versions, so these
 * are read by name and the counts checked below fail the run when they move. The new names are
 * the fields that hold the same values: AnecdoteExcelConfigData's id (100001 and up), area id,
 * text hashes of the title ("character·title"), hint and summary, the hidden flag (true on 34
 * rows), the test flag (true on 2), the variant's main entry, the entry it comes after, the NPC
 * and the time condition (QUEST_COND_IS_DAYTIME).
 */
const ANECDOTE = {
  id: "EPKOBMEGGPJ",
  area: "KGJDBEKMDEE",
  title: "DEKFJBEENEP",
  hint: "MGMDAJLHNKJ",
  summary: "MPDLGALMBIA",
  hidden: "GBBHHGKCGAF",
  test: "HFABDGALPNB",
  variantOf: "FEONHPFBAKO",
  after: "COFJMMANOEA",
  npc: "PGAPDBFFKAA",
  conditions: "ECOGMLHFBFB",
} as const
/** AnecdoteExtraExcelConfigData: the NPC id and its name's text hash. */
const ANECDOTE_EXTRA = { npc: "npcId", name: "DPMAEGABPOM" } as const
/** Counts as of 7.2; fewer means a field moved or the format changed. */
const ANECDOTE_MINIMUM = { entries: 156, hidden: 32, areas: 8, characters: 69 }

/** `characters` gives the GOOD key of each playable character's Chinese name. */
export async function buildCollection(
  snap: Pin,
  g: Game,
  characters: Map<string, string>,
): Promise<Collection> {
  const [achievementRows, goals, rewards, quests, snapAchievements] = await Promise.all([
    g.table("AchievementExcelConfigData.json"),
    g.table("AchievementGoalExcelConfigData.json"),
    g.table("RewardExcelConfigData.json"),
    g.table("MainQuestExcelConfigData.json"),
    download(snap.repo, snap.commit, "Genshin/CHS/Achievement.json").then(json =>
      list(JSON.parse(json), "Achievement.json"),
    ),
  ])
  const primogems = primogemRewards(rewards)
  const versions = new Map(snapAchievements.map(row => [row.Id, row.Version]))
  const questTypes = new Map(quests.map(row => [row.id, row.type]))
  const achievements = achievementRows
    .filter(row => !row.isDisuse)
    .map(row => achievement(g, row, primogems, versions, questTypes))
  const used = new Set(achievements.map(a => a.goal))
  const goalOrder = new Map<number, number>()
  const achievementGoals = goals
    .map(row => ({ id: Number(row.id ?? 0), name: g.text(row.nameTextMapHash), order: row }))
    .filter(goal => used.has(goal.id))
    .sort((a, b) => num(a.order, "orderId") - num(b.order, "orderId"))
    .map(({ id, name }, i) => {
      goalOrder.set(id, i)
      return { id, name }
    })
  if (goalOrder.size !== used.size) throw new Error("an achievement's goal is not in the goals")
  const order = new Map(achievementRows.map(row => [row.id, Number(row.orderId ?? 0)]))
  achievements.sort(
    (a, b) =>
      (goalOrder.get(a.goal) ?? 0) - (goalOrder.get(b.goal) ?? 0) ||
      (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) ||
      a.id - b.id,
  )
  return {
    achievementGoals,
    achievements,
    ...(await anecdotes(g, characters, primogems)),
    anecdoteRules,
  }
}

/** Primogems by reward id, for rewards that give any. */
function primogemRewards(rewards: Raw[]) {
  const table = new Map<number, number>()
  for (const row of rewards) {
    for (const item of list(row.rewardItemList ?? [], "rewardItemList")) {
      if (item.itemId === PRIMOGEM) table.set(num(row, "rewardId"), num(item, "itemCount"))
    }
  }
  return table
}

function achievement(
  g: Game,
  row: Raw,
  primogems: Map<number, number>,
  versions: Map<unknown, unknown>,
  questTypes: Map<unknown, unknown>,
): Achievement {
  const id = num(row, "id")
  const target = num(row, "progress")
  const show = row.progressShowType
  const thousandths = show === "PROGRESSTYPE_THOUSAND_TO_ONE"
  const shown = thousandths ? target / 1000 : target
  const version = versions.get(id)
  const quest = questKind(row, questTypes)
  return {
    id,
    goal: Number(row.goalId ?? 0),
    title: plain(g.text(row.titleTextMapHash)),
    desc: plain(g.text(row.descTextMapHash).replaceAll("{param0}", String(shown))),
    target,
    primogems: primogems.get(num(row, "finishRewardId")) ?? 0,
    ...(row.isShow === "SHOWTYPE_HIDE" ? { hidden: true as const } : {}),
    ...(typeof row.preStageAchievementId === "number"
      ? { previous: row.preStageAchievementId }
      : {}),
    ...(typeof version === "string" && version !== "" ? { version } : {}),
    ...(quest ? { quest } : {}),
    ...(show === "PROGRESSTYPE_FINISH" ? { count: "none" as const } : {}),
    ...(thousandths ? { count: "thousandths" as const } : {}),
  }
}

/**
 * From the main quest the achievement's trigger names. Finish-quest triggers name subquests,
 * whose main quest is the id without its last two digits; a quest variable is a main quest's
 * likewise. The main quest table's type is WQ for world quests, LQ for hangouts, IQ for
 * commissions and none for Archon Quests; co-op and daily triggers have no quest to look up.
 */
function questKind(row: Raw, types: Map<unknown, unknown>): QuestKind | undefined {
  const trigger = row.triggerConfig as Raw | undefined
  const kind = trigger?.triggerType
  const params = (Array.isArray(trigger?.paramList) ? trigger.paramList : [])
    .filter((p): p is string => typeof p === "string" && p !== "")
    .flatMap(p => p.split(","))
    .map(Number)
  let mains: number[]
  if (kind === "TRIGGER_FINISH_QUEST_AND" || kind === "TRIGGER_FINISH_QUEST_OR") {
    mains = params.map(id => Math.floor(id / 100))
  } else if (
    kind === "TRIGGER_FINISH_PARENT_QUEST_AND" ||
    kind === "TRIGGER_FINISH_PARENT_QUEST_OR"
  ) {
    mains = params
  } else if (kind === "TRIGGER_QUEST_GLOBAL_VAR_EQUAL") {
    mains = params.slice(0, 1).map(id => Math.floor(id / 100))
  } else if (kind === "TRIGGER_DAILY_TASK_VAR_EQUAL") {
    return "commission"
  } else if (
    kind === "TRIGGER_MAIN_COOP_SAVE_POINT_AND" ||
    kind === "TRIGGER_MAIN_COOP_VAR_EQUAL"
  ) {
    return "hangout"
  } else {
    return undefined
  }
  const main = mains.find(id => types.has(id))
  if (main === undefined) return undefined
  const type = types.get(main)
  if (type === undefined) return "archon"
  return ({ WQ: "world", LQ: "hangout", IQ: "commission" } as const)[String(type)]
}

async function anecdotes(g: Game, characters: Map<string, string>, primogems: Map<number, number>) {
  const [rows, extras, areaRows, constants] = await Promise.all([
    g.table("AnecdoteExcelConfigData.json"),
    g.table("AnecdoteExtraExcelConfigData.json"),
    g.table("AnecdoteAreaExcelConfigData.json"),
    g.table("AnecdoteConstExcelConfigData.json"),
  ])
  const npcs = new Map(
    extras.map(row => [num(row, ANECDOTE_EXTRA.npc), g.text(row[ANECDOTE_EXTRA.name])]),
  )
  const anecdoteVariants: Record<string, number> = {}
  const entries: Anecdote[] = []
  for (const row of rows) {
    if (row[ANECDOTE.test] === true) continue
    const id = num(row, ANECDOTE.id)
    const main = row[ANECDOTE.variantOf]
    if (typeof main === "number") {
      anecdoteVariants[id] = main
      continue
    }
    const name = npcs.get(num(row, ANECDOTE.npc))
    if (!name) throw new Error(`no name for the NPC of anecdote ${id}`)
    const title = g.text(row[ANECDOTE.title])
    const prefix = `${name}·`
    if (!title.startsWith(prefix)) throw new Error(`anecdote ${id} is not titled "${prefix}…"`)
    const hint = plain(g.text(row[ANECDOTE.hint]))
    const after = row[ANECDOTE.after]
    const time = daytime(row[ANECDOTE.conditions], id)
    entries.push({
      id,
      area: num(row, ANECDOTE.area),
      character: characters.get(name) ?? name,
      title: title.slice(prefix.length),
      summary: plain(g.text(row[ANECDOTE.summary])),
      ...(hint ? { hint } : {}),
      ...(row[ANECDOTE.hidden] === true ? { hidden: true as const } : {}),
      ...(typeof after === "number" ? { after } : {}),
      ...(time ? { time } : {}),
    })
  }
  const ids = new Set(entries.map(e => e.id))
  for (const [variant, main] of Object.entries(anecdoteVariants)) {
    if (!ids.has(main)) throw new Error(`anecdote variant ${variant} names ${main}, not an entry`)
  }
  const anecdoteAreas = Object.fromEntries(
    areaRows.map(row => [num(row, "areaId"), g.text(row.areaNameTextMapHash)]),
  )
  const counts = {
    entries: entries.length,
    hidden: entries.filter(e => e.hidden).length,
    areas: new Set(entries.map(e => e.area)).size,
    characters: new Set(entries.map(e => e.character)).size,
  }
  for (const [what, least] of Object.entries(ANECDOTE_MINIMUM)) {
    const found = counts[what as keyof typeof counts]
    if (found < least) throw new Error(`only ${found} anecdote ${what}, expected at least ${least}`)
  }
  for (const e of entries) {
    if (!(e.area in anecdoteAreas)) throw new Error(`anecdote ${e.id} is in unknown area ${e.area}`)
  }
  const rules = anecdoteRules
  for (const id of [
    rules.daily.id,
    rules.daily.last,
    rules.lauma.choice,
    rules.lauma.farewell,
    ...rules.chains.flat(),
  ]) {
    if (!ids.has(id)) throw new Error(`anecdote rule names ${id}, not an entry`)
  }
  const constant = (type: string) => {
    const value = Number(constants.find(row => row.type === type)?.param)
    if (!Number.isInteger(value) || value <= 0) throw new Error(`no anecdote constant ${type}`)
    return value
  }
  const reward = primogems.get(constant("ANECDOTE_REWARD_ID"))
  if (!reward) throw new Error("the anecdote reward gives no primogems")
  return {
    anecdoteAreas,
    anecdotes: entries,
    anecdoteVariants,
    anecdoteReward: { seals: constant("ANECDOTE_REWARD_TARGET_COUNT"), primogems: reward },
  }
}

/** The day or night condition some anecdotes have, with parameter 0 for day and 1 for night. */
function daytime(conditions: unknown, id: number): "day" | "night" | undefined {
  const found = list(conditions ?? [], `conditions of anecdote ${id}`).filter(
    c => c.type !== undefined,
  )
  if (found.length === 0) return undefined
  const [condition] = found
  if (found.length > 1 || condition?.type !== "QUEST_COND_IS_DAYTIME") {
    throw new Error(`anecdote ${id} has conditions other than the time of day`)
  }
  const param = str(condition, "param")
  if (param !== "0" && param !== "1") throw new Error(`time condition ${param} on anecdote ${id}`)
  return param === "0" ? "day" : "night"
}
