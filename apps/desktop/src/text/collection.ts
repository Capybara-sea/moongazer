// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** The collection pages' text: the overview of them, achievements and anecdotes. */

const n = (value: number) => value.toLocaleString("en-US")

export const collection = {
  title: "收集",
  back: "‹ 收集",
  hint: "点击卡片进入",
  percent: (done: number, total: number) => `${total > 0 ? Math.floor((done / total) * 100) : 0}%`,
  achievementsLeft: (primogems: number) => `尚可获得原石 ${n(primogems)}`,
  anecdotesLine: (earned: string, total: number, days: string) =>
    `逸闻印签 ${earned} / ${n(total)} · ${days}`,
  newer: (count: number) => `${n(count)} 条来自新版本，更新望月后显示`,
  furnishingLine: (primogems: number) => `伙伴原石尚可领取 ${n(primogems)}`,
  spincrystalLine: (placed: string, bag: number) => `已拥有 ${placed} · 在背包 ${n(bag)}`,
}

export const furnishingPage = {
  title: "摆设套装",
  summary: (total: number, indoor: number, outdoor: number) =>
    `共 ${n(total)} 套（室内 ${n(indoor)}、室外 ${n(outdoor)}）`,
  views: { sets: "按套装", characters: "按角色", furnishings: "所需摆设" },
  viewLabel: "查看方式",
  search: "搜索套装、角色或摆设",
  noBag:
    "此快照未读取到背包中的摆设数量，暂不显示是否齐全和缺少的摆设。使用望月的自动同步登录游戏后即可读取。",
  placedNote: "已摆放在洞天中的摆设无法读取，会计为缺少。",
  stats: "统计",
  learned: "已学会套装",
  learnedLine: "已学习套装图纸",
  whole: "背包中摆设齐全",
  wholeLine: (craftable: number) => `另有 ${n(craftable)} 套缺少的摆设均可制作`,
  wholeMissing: "未读取到背包数量",
  primogems: "伙伴原石尚可领取",
  primogemsLine: (claimed: number, total: number) => `已领取 ${n(claimed)} / ${n(total)} 次`,
  claimNeedNote:
    "仅计算尚可领取的套装。同一种摆设在多个套装中都需要时，按需要最多的一套计算（领取后可拆下用于下一套）。",
  indoor: "室内",
  outdoor: "室外",
  kinds: (kinds: number, pieces: number) => `${n(kinds)} 种 ${n(pieces)} 件`,
  notLearned: "未学习套装图纸",
  complete: "已齐全",
  short: (kinds: number, pieces: number) => `缺 ${n(kinds)} 种 ${n(pieces)} 件`,
  shortHow: (buy: number, blueprint: number) =>
    [
      ...(buy > 0 ? [`${n(buy)} 种需购买`] : []),
      ...(blueprint > 0 ? [`${n(blueprint)} 种未学习图纸`] : []),
    ].join(" · ") || "缺少的摆设均可制作",
  craftableKinds: (kinds: number) => `可制作 ${n(kinds)} 种`,
  claimable: (primogems: number) => `原石 ×${n(primogems)}`,
  units: "组成",
  columns: {
    item: "摆设",
    need: "需要",
    have: "背包里",
    short: "缺",
    getting: "获取",
    usedBy: "用于",
  },
  usedBy: (sets: string[]) =>
    sets.length > 3 ? `${sets.slice(0, 3).join("、")} 等 ${n(sets.length)} 套` : sets.join("、"),
  onlyShort: "仅显示缺少的",
  noneShort: "背包中已有全部所需摆设",
  noneFurnishings: "无符合条件的摆设",
  getting: { craft: "可制作", blueprint: "未学习图纸", buy: "需购买" } as Record<string, string>,
  recipe: (parts: string[]) => `配方：${parts.join("、")}`,
  sources: (sources: string[]) => sources.join("、"),
  materials: "制作所需材料",
  materialsWhole: "制作所需材料（整套）",
  materialShort: (count: number) => `差 ${n(count)}`,
  noMaterials: "暂无可制作的缺少摆设",
  characterClaimable: (count: number, primogems: number) =>
    `可领取 ${n(count)} 次 · 原石 ×${n(primogems)}`,
  none: "无符合条件的套装",
  allClaimed: "暂无可领取的伙伴原石（已领完，或尚未拥有对应角色）",
  notRead: "此快照未读取到摆设套装。",
}

export const spincrystalPage = {
  title: "旋曜玉帛",
  summary: (total: number) => `共 ${n(total)} 个`,
  stats: "统计",
  had: "已获得",
  placed: "已拥有",
  placedLine: "已放入尘歌壶",
  bag: "在背包",
  bagLine: "放入尘歌壶后即可播放",
  none: "未拥有",
  notPlacedRead: "未读取到",
  realmNote: "此快照中没有已放入尘歌壶的旋曜玉帛列表（一个都未放入时游戏不会发送），仅按背包计算。",
  areas: "地区",
  allAreas: "全部",
  filters: { all: "全部", placed: "已拥有", bag: "在背包", none: "未拥有" } as Record<
    string,
    string
  >,
  filterLabel: "状态",
  columns: { label: "编号", song: "曲名", hint: "获取地点", status: "状态" },
  status: { placed: "已拥有", bag: "在背包", none: "未拥有" } as Record<string, string>,
  noMatch: "无符合条件的旋曜玉帛",
}

export const achievementPage = {
  title: "成就",
  summary: (done: number, total: number, earned: number, primogems: number) =>
    `已完成 ${n(done)} / ${n(total)} · 原石已得 ${n(earned)} / ${n(primogems)}`,
  todo: "未完成",
  todoValue: (count: number) => `${n(count)} 个`,
  primogemsLeft: "尚可获得原石",
  byState: "完成状态",
  filters: { all: "全部", done: "已完成", todo: "未完成" },
  search: "搜索标题或描述",
  sort: "排序",
  sorts: { game: "默认", recent: "完成时间" },
  hideHidden: "不含隐藏成就",
  goals: "成就分类",
  allGoals: "全部分类",
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
  searchFailed: "无法打开浏览器",
  none: "无符合条件的成就",
  notRead: "此快照未读取到成就。",
}

export const anecdotePage = {
  title: "游逸旅闻",
  summary: (total: number, hidden: number) => `共 ${n(total)} 条（含 ${n(hidden)} 条隐藏）`,
  hasLauma: "已拥有菈乌玛",
  noLauma: "未拥有菈乌玛",
  lastWish: (at: string) => `上次许愿 ${at}`,
  laumaChip: { yes: "已有菈乌玛", no: "没有菈乌玛" },
  laumaTip: { yes: "点击查看两种情况的区别", no: "点击查看两种情况的区别" },
  laumaTitle: "是否拥有菈乌玛的区别",
  laumaLabel: (chip: string) => `${chip}，是否拥有菈乌玛的区别`,
  laumaAuto: "根据账号中的角色自动判断，无需手动选择。",
  laumaWith: (total: number, choice: string, farewell: string, seals: number) =>
    `拥有菈乌玛：共 ${n(total)} 条。「${choice}」完成 1 次后出现「${farewell}」（获得 ${seals} 枚印签）。`,
  laumaWithout: (total: number, choice: string, farewell: string, days: number) =>
    `未拥有菈乌玛：共 ${n(total)} 条。「${farewell}」不会出现；「${choice}」需连续完成 ${days} 天，每天 1 枚印签。`,
  laumaSeals: (withHer: number, without: number) =>
    `印签总数因此不同：拥有时 ${n(withHer)} 枚，未拥有时 ${n(without)} 枚。`,
  onlyTodo: "仅显示未完成",
  onlyHidden: "仅显示隐藏",
  search: "搜索标题、描述、角色",
  full: (seals: number, primogems: number) =>
    `逸闻印签已集满 ${seals} 枚，请先在游戏中领取奖励（${primogems} 原石）。领取前不会刷新新的旅闻。`,
  stats: "统计",
  done: "已完成",
  doneLine: (waiting: number, unmet: number) => `待完成 ${n(waiting)} · 未遇到 ${n(unmet)}`,
  seals: "逸闻印签",
  sealsLine: (progress: number, target: number, primogems: number) =>
    `本档 ${progress} / ${target} · 集满 ${target} 枚可领取原石 ×${primogems}`,
  sealsFull: (progress: number, target: number) => `本档 ${progress} / ${target} · 奖励待领取`,
  sealsNotRead: "未读取到本档进度",
  fastest: "最快还需",
  fastestValue: (days: number) => `约 ${n(days)} 天`,
  fastestDone: "全部完成",
  fastestLine: (hidden: number, normal: number) =>
    `剩余隐藏 ${n(hidden)} 条 · 非隐藏 ${n(normal)} 次`,
  fastestShort: (days: number) => (days > 0 ? `最快还需约 ${n(days)} 天` : "全部完成"),
  how: "计算方法",
  howTitle: "计算方法",
  howTotal: (total: number, hidden: number, withoutLauma: number, farewell: string, has: boolean) =>
    `总条数：共 ${n(total)} 条（含 ${n(hidden)} 条隐藏）。未拥有菈乌玛时「${farewell}」不会出现，按 ${n(withoutLauma)} 条计算。当前账号${has ? "已拥有" : "未拥有"}菈乌玛（根据账号中的角色自动判断）。`,
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
    `印签：每条 1 枚，两组例外：「${daily}」每完成一天 1 枚，「${then}」补足至合计 ${total} 枚；「${choice}」在拥有菈乌玛时 1 枚、「${farewell}」${seals} 枚，未拥有时「${choice}」需完成 ${days} 天、每天 1 枚。因此拥有时共 ${n(withHer)} 枚，未拥有时共 ${n(without)} 枚。已获得数量采用游戏内计数（每 ${reward} 枚可领取一次 ${primogems} 原石）。`,
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
    return `${parts.join("；")}。取最大值：约 ${n(days)} 天。`
  },
  chain: (names: string[]) => names.map(name => `「${name}」`).join(" → "),
  howNote:
    "非隐藏条目每天刷新 0～5 条，常被剧情任务占用；隐藏条目按概率触发、无法许愿，需先完成对应操作，实际通常更久。",
  areas: "地区",
  allAreas: "全部",
  characters: "角色",
  allCharacters: (left: number) => (left > 0 ? `全部角色 · 剩余 ${n(left)} 条` : "全部角色"),
  gridNote: (others: number, all: number) =>
    `另有 ${n(others)} 位已全部完成（取消"仅显示未完成"可查看全部 ${n(all)} 位）`,
  gridAll: (all: number) => `共 ${n(all)} 位角色，新角色在前`,
  allDone: "全部完成",
  areaList: (names: string[]) => names.join("、"),
  sectionInfo: (count: number, done: number, areas: string) =>
    `${n(count)} 条 · 已完成 ${n(done)} · ${areas}`,
  entries: "条目",
  status: { recorded: "已记录", waiting: "待完成", unmet: "未遇到", absent: "不计入" } as Record<
    string,
    string
  >,
  hidden: "隐藏",
  sealsTag: (seals: number) => `✦ ${seals}`,
  daily: "✦ 每天 1",
  dailyDone: (days: number) => `累计 ${days} 天`,
  pairTotal: (name: string, total: number) => `与「${name}」合计 ${total}`,
  repeatDays: (days: number, done: number) => `分 ${days} 天 · ${Math.min(done, days)}/${days}`,
  needsLauma: "需要菈乌玛",
  absent: "未拥有菈乌玛时此条不会出现，不计入总数",
  hiddenLine: "隐藏逸闻：有概率出现，无法许愿，每天最多 1 条",
  peek: "查看概要（可能剧透）",
  unpeek: "收起",
  after: (name: string) => `在「${name}」之后出现`,
  time: { day: "仅在白天出现", night: "仅在夜晚出现" } as Record<string, string>,
  trigger: (how: string) => `触发：${how}，有概率出现`,
  place: (place: string) => `地点：${place}`,
  tips: "遇见提示",
  needAnecdote: (name: string) => `「${name}」`,
  needCharacter: (name: string) => `拥有${name}`,
  needMet: (what: string) => `前置：${what}`,
  needDone: "已完成",
  needOpen: (what: string) => `前置：${what}，尚未完成，此条暂不会出现`,
  needMissing: (what: string) => `前置：${what}，尚未满足，此条暂不会出现`,
  needUnknown: (what: string) => `前置：${what}（无法从此快照判断是否完成）`,
  unsure: (what: string) => `待确定：${what}`,
  video: "视频攻略",
  videoLabel: (title: string) => `在 B 站搜索 UP 主栖霆杨的「${title}」视频攻略`,
  videoKeyword: (title: string) => `栖霆杨 游逸旅闻 ${title}`,
  source: "每条旅闻的地点和前置、隐藏逸闻的触发方式，参考 B 站 UP 主栖霆杨的「原神游逸旅闻」整理",
  openSource: "打开",
  openSourceLabel: "在浏览器中打开「原神游逸旅闻」",
  openFailed: "无法打开浏览器",
  none: "已全部完成",
  noMatch: "无符合条件的旅闻",
  notRead: "此快照未读取到游逸旅闻。",
}
