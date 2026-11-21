// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** The collection pages' text: the overview of them, achievements and anecdotes. */

const n = (value: number) => value.toLocaleString("en-US")

export const collection = {
  title: "收集",
  back: "‹ 收集",
  hint: "点卡片进入",
  percent: (done: number, total: number) => `${total > 0 ? Math.floor((done / total) * 100) : 0}%`,
  achievementsLeft: (primogems: number) => `还能拿原石 ${n(primogems)}`,
  anecdotesLine: (earned: string, total: number, days: string) =>
    `逸闻印签 ${earned} / ${n(total)} · ${days}`,
  newer: (count: number) => `${n(count)} 条是新版本加的，更新望月后显示`,
}

export const achievementPage = {
  title: "成就",
  summary: (done: number, total: number, earned: number, primogems: number) =>
    `已完成 ${n(done)} / ${n(total)} · 原石已得 ${n(earned)} / ${n(primogems)}`,
  todo: "还没完成",
  todoValue: (count: number) => `${n(count)} 个`,
  primogemsLeft: "还能拿原石",
  byState: "完成状态",
  filters: { all: "全部", done: "已完成", todo: "未完成" },
  search: "搜索标题或描述",
  hideHidden: "不显示隐藏成就",
  goals: "成就分类",
  allGoals: "全部分类",
  goalInfo: (done: number, total: number) => `${n(done)} / ${n(total)} 已完成`,
  hidden: "隐藏",
  done: "已完成",
  notDone: "未完成",
  primogems: (count: number) => `原石 ${count}`,
  quest: { world: "任务", archon: "魔神", hangout: "邀约", commission: "委托" } as Record<
    string,
    string
  >,
  version: (version: string) => `${version} 版本加入`,
  searchVideo: (title: string) => `在 B 站搜索「${title}」`,
  searchKeyword: (title: string) => `原神 ${title}`,
  searchFailed: "打不开浏览器",
  none: "这里没有符合条件的成就",
  notRead: "这份快照没读到成就。",
}

export const anecdotePage = {
  title: "游逸旅闻",
  summary: (total: number, hidden: number) => `共 ${n(total)} 条（含 ${n(hidden)} 条隐藏）`,
  hasLauma: "本号有菈乌玛",
  noLauma: "本号没有菈乌玛",
  lastWish: (at: string) => `上次许愿 ${at}`,
  laumaChip: { yes: "已有菈乌玛", no: "没有菈乌玛" },
  laumaTip: { yes: "点开看有没有她的区别", no: "点开看有没有她的区别" },
  laumaTitle: "有没有菈乌玛，差在哪",
  laumaLabel: (chip: string) => `${chip}，有没有菈乌玛，差在哪`,
  laumaAuto: "按账号里的角色自动判断，不用手动选。",
  laumaWith: (total: number, choice: string, farewell: string, seals: number) =>
    `有菈乌玛：共 ${n(total)} 条。「${choice}」做 1 次，接着出现「${farewell}」（给 ${seals} 枚印签）。`,
  laumaWithout: (total: number, choice: string, farewell: string, days: number) =>
    `没有菈乌玛：共 ${n(total)} 条。「${farewell}」不会出现；「${choice}」要连做 ${days} 天，每天 1 枚印签。`,
  laumaSeals: (withHer: number, without: number) =>
    `印签总数因此不同：有她 ${n(withHer)} 枚，没有她 ${n(without)} 枚。`,
  onlyTodo: "只看未完成",
  onlyHidden: "只看隐藏",
  search: "搜索标题、描述、角色",
  full: (seals: number, primogems: number) =>
    `逸闻印签攒满 ${seals} 枚了，先去游戏里领奖励（${primogems} 原石）。不领的话，不会刷新新的旅闻。`,
  stats: "统计",
  done: "已完成",
  doneLine: (waiting: number, unmet: number) => `待完成 ${n(waiting)} · 没遇到 ${n(unmet)}`,
  seals: "逸闻印签",
  sealsLine: (progress: number, target: number, primogems: number) =>
    `本档 ${progress} / ${target} · 满 ${target} 枚领原石 ×${primogems}`,
  sealsFull: (progress: number, target: number) => `本档 ${progress} / ${target} · 先去领奖励`,
  sealsNotRead: "导出里没有本档进度",
  fastest: "最快还需",
  fastestValue: (days: number) => `约 ${n(days)} 天`,
  fastestDone: "都做完了",
  fastestLine: (hidden: number, normal: number) => `剩 ${n(hidden)} 条隐藏 · ${n(normal)} 次非隐藏`,
  fastestShort: (days: number) => (days > 0 ? `最快还需约 ${n(days)} 天` : "都做完了"),
  how: "怎么算的",
  howTitle: "这些数怎么算的",
  howTotal: (total: number, hidden: number, withoutLauma: number, farewell: string, has: boolean) =>
    `总条数：共 ${n(total)} 条（含 ${n(hidden)} 条隐藏）。没有菈乌玛时「${farewell}」不会出现，按 ${n(withoutLauma)} 条算。本号${has ? "有" : "没有"}菈乌玛（按账号里的角色自动判断）。`,
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
    `印签：每条 1 枚，两对特殊：「${daily}」每做一天 1 枚，「${then}」补到合计 ${total} 枚；「${choice}」有菈乌玛时 1 枚、「${farewell}」${seals} 枚，没有她时「${choice}」做 ${days} 天、每天 1 枚。所以有她 ${n(withHer)} 枚，没有她 ${n(without)} 枚。已获的数直接用游戏自己的计数（每 ${reward} 枚换一次 ${primogems} 原石）。`,
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
      `最快还需：隐藏 ${n(hidden)} 条，每天最多 1 条 → ${n(hidden)} 天`,
      `非隐藏 ${n(normal)} 次，按每天 ${perDay} 条 → ${n(normalDays)} 天`,
      ...(chain ? [`${chain} → 至少 ${n(chainDays)} 天`] : []),
    ]
    return `${parts.join("；")}。取最大：约 ${n(days)} 天。`
  },
  chain: (names: string[]) => names.map(name => `「${name}」`).join(" → "),
  howNote:
    "非隐藏的每天刷 0～5 条，常被剧情任务占；隐藏的概率触发、不能许愿，要先做对应的动作，实际多半更久。",
  areas: "地区",
  allAreas: "全部",
  characters: "角色",
  allCharacters: (left: number) => (left > 0 ? `全部角色 · 还差 ${n(left)} 条` : "全部角色"),
  gridNote: (others: number, all: number) =>
    `另有 ${n(others)} 位已全部完成（取消"只看未完成"可看全部 ${n(all)} 位）`,
  gridAll: (all: number) => `共 ${n(all)} 位角色，新角色在前`,
  allDone: "全部完成",
  areaList: (names: string[]) => names.join("、"),
  sectionInfo: (count: number, done: number, areas: string) =>
    `${n(count)} 条 · 已完成 ${n(done)} · ${areas}`,
  entries: "条目",
  status: { recorded: "已记录", waiting: "待完成", unmet: "没遇到", absent: "不计入" } as Record<
    string,
    string
  >,
  hidden: "隐藏",
  sealsTag: (seals: number) => `✦ ${seals}`,
  daily: "✦ 每天 1",
  dailyDone: (days: number) => `已做 ${days} 天`,
  pairTotal: (name: string, total: number) => `和「${name}」合计 ${total}`,
  repeatDays: (days: number, done: number) => `分 ${days} 天 · ${Math.min(done, days)}/${days}`,
  needsLauma: "需要菈乌玛",
  absent: "没有菈乌玛时这条不会出现，不计入总数",
  hiddenLine: "隐藏逸闻：有几率出现，不能许愿，每天最多 1 条",
  peek: "看概要（可能剧透）",
  unpeek: "收起",
  after: (name: string) => `接在「${name}」之后`,
  time: { day: "只在白天出现", night: "只在夜晚出现" } as Record<string, string>,
  trigger: (how: string) => `触发：${how}，有几率出现`,
  place: (place: string) => `地点：${place}`,
  tips: "怎么遇到",
  needAnecdote: (name: string) => `「${name}」`,
  needCharacter: (name: string) => `拥有${name}`,
  needMet: (what: string) => `前置：${what}`,
  needDone: "已完成",
  needOpen: (what: string) => `前置：${what}，还没完成，这条还不会出现`,
  needMissing: (what: string) => `前置：${what}，还没有，这条还不会出现`,
  needUnknown: (what: string) => `前置：${what}（这份快照看不出是否完成）`,
  unsure: (what: string) => `待确定：${what}`,
  source: "每条旅闻的地点和前置、隐藏逸闻的触发方式，参考 B 站 UP 主栖霆杨的「原神游逸旅闻」整理",
  openSource: "打开",
  openSourceLabel: "在浏览器里打开「原神游逸旅闻」",
  openFailed: "打不开浏览器",
  none: "这里的都完成了",
  noMatch: "这里没有符合条件的旅闻",
  notRead: "这份快照没读到游逸旅闻。",
}
