// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

type City = { name: string; offerings: number[] }

// The game calls each twin just Traveler, whatever the element.
export const travelerNames: Record<string, string> = {
  TravelerAnemo: "旅行者（风元素）",
  TravelerGeo: "旅行者（岩元素）",
  TravelerElectro: "旅行者（雷元素）",
  TravelerDendro: "旅行者（草元素）",
  TravelerHydro: "旅行者（水元素）",
  TravelerPyro: "旅行者（火元素）",
  TravelerCryo: "旅行者（冰元素）",
}

// How the game's Chinese text marks test and retired items.
export const unusedItem = /^\(test\)|（废弃）/

// For the overview page. Written by hand: the game's city table has its names only in obfuscated
// fields, and the game's text has no names at all for offerings 1-9 or the theater's difficulties.
// Offerings are listed only under a city they are known to belong to: 9-24 by their scene point's
// area. 16 is in the Firmament, not a city; 19 has no point.
export const cities: Record<string, City> = {
  1: { name: "蒙德", offerings: [1] },
  2: { name: "璃月", offerings: [3, 8] },
  3: { name: "稻妻", offerings: [2, 4] },
  4: { name: "须弥", offerings: [5, 6] },
  5: { name: "枫丹", offerings: [7] },
  6: { name: "纳塔", offerings: [9] },
  7: { name: "挪德卡莱", offerings: [10, 11, 12, 13, 14, 15, 17, 18] },
  8: { name: "至冬", offerings: [20, 21, 22, 23, 24] },
}
export const offerings: Record<string, string> = {
  1: "忍冬之树",
  2: "神樱眷顾",
  3: "流明石触媒",
  4: "三界路飨祭",
  5: "梦之树",
  6: "甘露池",
  7: "露景泉",
  8: "祀珑典仪",
  9: "煅石之轮",
  10: "聚所·终夜长茔",
  11: "聚所·叮铃哐啷蛋卷工坊",
  12: "聚所·霜月之坊",
  13: "聚所·魔女的花园",
  14: "聚所·西风戍垒",
  15: "聚所·望崖营壁",
  17: "努尔寂石阵列",
  18: "幕形态黑体物质笼实验室",
  20: "聚所·汐歌洞窟",
  21: "聚所·巡猎者木屋",
  22: "聚所·科洛列夫茨基剧院",
  23: "聚所·特普洛绿洲",
  24: "聚所·皇家轨道运输局",
}
export const theaterLevels: Record<string, string> = {
  1: "简单",
  2: "普通",
  3: "困难",
  4: "卓越",
  5: "月谕",
}
// The materials page's tabs, in its order, each with the game types it shows in their order, by
// the game's English type names. A region's specialties not listed go after the listed ones
// in their tab; any other type goes after the listed ones under other.
export const materialTabs: Record<string, string[]> = {
  develop: [
    "Character EXP Material",
    "Weapon Enhancement Material",
    "Artifact Enhancement Material",
    "Character Ascension Material",
    "Character Level-Up Material",
    "Character Talent Material",
    "Weapon Ascension Material",
    "Character and Weapon Enhancement Material",
  ],
  currency: [
    "Common Currency",
    "Special Currency",
    "Limited Wishing Item",
    "Wishing Item",
    "Superior Voucher",
    "Common Voucher",
    "City States Sigil",
    "Sigil",
    "Challenge Result Item",
  ],
  specialty: [
    "Local Specialty (Mondstadt)",
    "Local Specialty (Liyue)",
    "Local Specialty (Inazuma)",
    "Local Specialty (Sumeru)",
    "Local Specialty (Fontaine)",
    "Local Specialty (Natlan)",
    "Local Specialty (Nod-Krai)",
    "Local Specialty (Snezhnaya)",
  ],
  food: ["Food", "Potion", "Recipe"],
  material: [
    "Cooking Ingredient",
    "Material",
    "Forging Ore",
    "Refinement Material",
    "Fish",
    "Bait",
    "Lantern Rite Material",
    "Dragonspine Material",
    "Fractured Fruit Shard",
    "Fractured Fruit Fragment",
    "Fractured Fruit Bit",
  ],
  item: [
    "Gadget",
    "Adventure Item",
    "Consumable",
    "Fireworks",
    "Fishing Rod",
    "Reliquary",
    "Character Outfits",
    "Forging Blueprint",
    "Crafting Blueprint",
    "Bait Blueprint",
    "Bundle",
    "Furnishing Blueprint",
    "Furnishing Set Blueprint",
  ],
  other: ["Quest Item", "Very Special Item"],
}

// Anecdotes that do not give one seal each, checked against two accounts' exports and a capture
// (2026-11-21). The game's table says none of this.
export const anecdoteRules = {
  // Heizou's "静待…" can come back on 1-5 days, a seal each day; "破案日" then tops the two up to
  // `total`.
  daily: { id: 101604, last: 101605, total: 6 },
  // Aino's "时间足够你道别" comes only for an account with Lauma, after "选择…", and gives `seals`.
  // Without her, "选择…" comes back on `days` days instead, a seal each day.
  lauma: { character: "Lauma", choice: 103702, farewell: 103703, seals: 5, days: 5 },
  // Entries that come one after another, a day apart at least: Heizou's and Sayu's, Aino's, and
  // Ineffa's and Jahoda's.
  chains: [
    [101604, 101701, 101605],
    [103702, 103703],
    [103602, 103604],
  ],
}
