// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/** The wish history page's text: records, past banners, banner history and the calculator. */

import type { Text } from "@/i18n"

const n = (value: number) => value.toLocaleString("en-US")
const pct = (share: number) => `${(share * 100).toFixed(2)}%`
/** "1 wish", "3 wishes". */
const counted = (value: number, one: string, many = `${one}s`) =>
  `${n(value)} ${value === 1 ? one : many}`

export const wishes: Text["wishes"] = {
  nav: "Wishes",
  list: (items: readonly string[]) => items.join(", "),
  subtitle: (name: string, count: number, from: string, to: string) =>
    `${name} · ${counted(count, "record")} · ${from} to ${to}`,
  views: {
    records: "Wish records",
    predict: "Wish forecast",
    banners: "Past banners",
    history: "Banner history",
  },
  viewLabel: "Wishes",
  noAccount:
    "Import or sync account data first. Wish history is kept per account, so Moongazer needs to know the account.",
  noUid: "This snapshot has no UID, so its wish history cannot be kept.",
  loadFailed: "Failed to read the wish history",
  pools: {
    character: "Character Event",
    weapon: "Weapon Event",
    chronicled: "Chronicled",
    standard: "Standard",
    novice: "Beginners'",
  },
  importButton: "Import",
  importFile: "Import UIGF file",
  exportButton: "Export",
  exportFile: "Export UIGF file…",
  exportLine: (name: string, count: number) =>
    `${name} · every banner · ${counted(count, "record")}`,
  aboutUigf: "About the UIGF format",
  exportName: (name: string, date: string) => `UIGF_${name}_${date}.json`,
  itemTypes: { characters: "Character", weapons: "Weapon" },
  uigfLang: "en-us",
  autoRead: {
    on: "Automatic reading",
    off: "Automatic reading is off",
    hint: 'While auto sync runs, open "Wish → History" in the game to read new records',
    last: (when: string) => `Last read ${when}`,
    settings: "Settings ›",
    reading: "Reading the wish history",
    waiting: "Waiting",
    pending: "Reading…",
    bannerAdded: (count: number) => `${n(count)} new`,
  },
  notice: {
    close: "Close",
    readDone: (added: number, parts: string) =>
      added > 0 ? `Read: ${counted(added, "new record")} (${parts})` : "Read: no new records",
    readSaved: (added: number, parts: string) => `Saved ${counted(added, "new record")} (${parts})`,
    readPart: (pool: string, count: number) => `${pool} ${n(count)}`,
    readErrors: {
      expired: "The wish history key has expired. Open the history in the game again.",
      busy: "The wish history service is busy. Open the history in the game again later.",
      failed: "Reading failed. Open the history in the game again later.",
      otherAccount:
        "The records read belong to another account than the one logged in; reading stopped.",
      stopped: "Reading stopped.",
    },
    imported: (added: number, known: number) =>
      `Imported: ${counted(added, "new record")}, ${n(known)} already kept`,
    importedOther: (uid: string, added: number) => `UID ${uid}: ${counted(added, "new record")}`,
    unknownItems: (count: number) =>
      `${counted(count, "record")} name an item the bundled data lacks; shown by the name in the file`,
    skipped: (count: number) =>
      `Skipped ${counted(count, "record")} of other banners (such as Miliastra Wonderland) or that could not be read`,
    gap: "The imported records do not overlap the ones kept; some in between may be missing",
    notUigf: "This is not a UIGF file",
    oldVersion: (version: string) => `UIGF ${version} is not supported; only v4 and later`,
    noGenshin: "The file has no Genshin Impact wish history",
    noMatch: "None of the file's accounts is in Moongazer; nothing was imported",
    importFailed: "Import failed",
    exported: (count: number, file: string) =>
      `Exported ${counted(count, "record")} (UIGF v4): ${file}`,
    exportFailed: "Export failed",
    reveal: "Show in folder",
  },
  importDialog: {
    title: "Choose the accounts to import",
    line: (uid: string, count: number) => `UID ${uid} · ${counted(count, "record")}`,
    unknown: "Not in Moongazer; skipped",
    confirm: "Import",
    cancel: "Cancel",
  },
  display: {
    button: "Banner display settings",
    title: "Banners shown",
    hideEmpty: "Hide banners without records",
    hideEmptyNote: (names: string) =>
      names ? `Without records now: ${names}` : "Every banner has records",
    hideNovice: "Hide the Beginners' Wish",
    hideNoviceNote: "The Beginners' Wish stops changing after its 20 wishes",
    note: 'Remembered; also in Settings under "Wishes"',
    hidden: (count: number, names: string) =>
      `${counted(count, "banner")} hidden: ${names} · Display settings ›`,
    emptyMark: " (no records)",
  },
  row: {
    pulls: "wishes",
    pity: "Pity",
    made: "Made",
    guaranteed: "Guaranteed",
    guaranteedTip: "The next 5-star is the featured one",
    guaranteedWeaponTip: "The next 5-star is a featured weapon",
    small: "50/50",
    smallTip: "The next 5-star is featured with a 50% chance",
    smallWeaponTip: "The next 5-star is a featured weapon with a 75% chance",
    radiance: (count: number) => `Radiance ${count} / 3`,
    radianceTip: (count: number) =>
      `From the records: ${counted(count, "50/50")} lost in a row (since 5.0). After 3 lost in a row, the next 50/50 is won by Capturing Radiance`,
    fate: (points: number) => `Fate ${points} / 1`,
    fateRead: (when: string) => `As the wish screen showed it on ${when}`,
    fateGuess: "Epitomized Path not read; worked out from the records",
    noFive: "No 5-star yet",
    noviceDone: "All made",
    five: "5-star",
    four: "4-star",
    average: "Average",
    averageUp: (value: string) => `Featured ${value}`,
    rate: pct,
    rarityLabel: (pool: string) => `${pool} rarity`,
    strip: (pool: string) => `${pool} pulls, newest on the left`,
    all: "All records ›",
    range: (from: string, to: string) => (from === to ? from : `${from} – ${to}`),
    empty: "No records",
    none5: "No 5-stars",
    none4: "No 4-stars",
    current: "Pity",
    currentTip: (count: number) => `${counted(count, "wish", "wishes")} since the last 5-star`,
  },
  tags: {
    won: "Won",
    guaranteed: "Guaranteed",
    lost: "Lost",
    radiance: "Radiance",
  },
  tagNotes: {
    won: "won the 50/50",
    guaranteed: "the featured one after a lost 50/50",
    lost: "a standard 5-star",
    radiance: "won after 3 lost in a row (worked out)",
  },
  legendNumber: "Number = the wish it came on",
  luck: { good: "≤ 60", fair: "61–75", bad: "> 75" },
  full: {
    title: "All records",
    sub: (name: string, scope: string, count: number) =>
      `${name} · ${scope} · ${counted(count, "record")}`,
    allPools: "All",
    allScope: "Every banner",
    star: (rank: number) => `${rank}★`,
    search: "Search characters or weapons",
    columns: { time: "Time", item: "Item", pity: "Wish", banner: "Banner" },
    foot: (count: number) => `${counted(count, "record")} · 50 a page`,
    none: "No matching records",
    close: "Close",
  },
  empty: {
    autoTitle: "Read automatically (recommended)",
    steps: [
      'Turn on "Read wish history automatically" below',
      "Start Moongazer's auto sync and enter the game",
      'Open "Wish → History" in the game',
    ],
    autoNote:
      "Reading uses the temporary key the game sends to reach the official wish history service online. The key stays in memory only, is never written to files or logs, and expires after about a day.",
    importTitle: "Import a file",
    importBody:
      'UIGF v4 files are supported, such as those saved with "Save records…" in Teyvat.me Capture. They can add records older than the game still shows.',
    footnote:
      "The game shows only about the last 6 months; once read or imported, Moongazer keeps them.",
  },
  autoReadSwitch: "Read wish history automatically",
  calc: {
    title: "Wish forecast",
    sub: (when: string) => `From the bag as of ${when} · shared by the three event banners`,
    noBag: "No bag data; currencies are counted as 0",
    total: "Event wishes available",
    unit: "wishes",
    parts: { have: "have", refund: "given back", extra: "extra" },
    acquaint: (count: number) => `Plus ${counted(count, "Acquaint Fate")} for the Standard Wish`,
    pulls: (count: number) => counted(count, "wish", "wishes"),
    stardust: (count: number) => `${n(count)} more this month`,
    stardustGuess: "This month's purchases were not read; counted as none",
    counted: (count: number) => `Counted +${n(count)}`,
    count: "Count",
    genesisLabel: "Count Genesis Crystals",
    refund: "Refunds",
    refundNote: (starglitter: string, maxed: number, total: number) =>
      `Starglitter from wishes turned into fates too: ${starglitter} back a wish on average (${maxed} of ${total} 4-star characters at C6)`,
    refundLabel: "Count the Starglitter wishes give back",
    extra: "Extra wishes",
    extraHint: "Such as what you still get before the banner ends",
    extraDec: "10 fewer wishes",
    extraInc: "10 more wishes",
    pityTitle: "Pity",
    pityHint: "From the records; you can change it",
    pityReset: "Back to the records",
    fields: { pity: "Pity", guarantee: "Guarantee", radiance: "Radiance", fate: "Fate" },
    guaranteed: "Guaranteed",
    small: "50/50",
    modes: { simple: "Simple", multi: "Several targets" },
    modeLabel: "Calculation",
    strategy: "Strategy",
    strategyLabel: (key: "weapon" | number) =>
      key === "weapon" ? "Weapon first" : `C${key} first`,
    strategyNote: (key: "weapon" | number) =>
      key === "weapon"
        ? "The signature weapon to R1 first, then the character"
        : `The character to C${key} first, then the weapon to R1, then the character to C6`,
    target: "Target",
    chance: (budget: number) => `Chance with ${counted(budget, "wish", "wishes")}`,
    mean: "Wishes on average",
    cons: (count: number) => `C${count}`,
    refine: (count: number) => `R${count}`,
    multiHint:
      "Wished for from top to bottom; drag a handle to reorder. Each row is the chance and the wishes up to that target",
    addCharacter: "+ Character",
    addWeapon: "+ Weapon",
    pickCharacter: "Add a character",
    addCustom: "Custom character",
    customName: "New character",
    customNameLabel: "Character name",
    pickWeapon: "Add a weapon",
    pickSearch: "Search",
    close: "Close",
    remove: (name: string) => `Remove ${name}`,
    drag: (name: string) => `Drag to reorder ${name}`,
    character: "Character",
    weapon: "Weapon",
    have: (label: string) => `Now ${label}`,
    notOwned: "Not owned",
    cumulative: (count: number) => `${n(count)} wishes on average in all`,
    noTargets: "No targets yet; add one below",
    stepLabel: (label: string) => `Target ${label}`,
    model:
      "Estimated with the public model of the rates: the 5-star chance rises with each wish from the 74th (characters) and 63rd (weapons), certain at 90 and 80; a character 50/50 is 50%, won for sure after 3 lost in a row (Capturing Radiance); weapons by the Epitomized Path; Starglitter given back is counted as an average.",
    percent: (share: number) =>
      share >= 0.9995 ? "100%" : share < 0.001 ? "< 0.1%" : `${(share * 100).toFixed(1)}%`,
  },
  banners: {
    subtitle: "Each banner's featured items, and what you wished and got on it",
    filters: {
      all: "All",
      character: "Character Event",
      weapon: "Weapon Event",
      chronicled: "Chronicled",
    },
    filterLabel: "Banner type",
    onlyPulled: "Only banners wished on",
    sum: (pulls: number, fives: number, ups: number) =>
      `${counted(pulls, "wish", "wishes")} · ${fives} 5-star · ${ups} featured`,
    phase: (second: boolean, from: string, to: string) =>
      `${second ? "Second half" : "First half"} · ${from} – ${to}`,
    result: { got: "Featured won", missed: "No featured", none: "Not wished on" },
    pulls: (count: number) => `${n(count)}`,
    fours: (count: number) => `4-star ${count}`,
    carried: (count: number) => `Pity ${count} carried on`,
    noFive: "No 5-star",
    notPulled: "Not wished on",
    up5: (name: string) => `${name} (featured 5-star)`,
    up4: (name: string) => `${name} (featured 4-star)`,
    more: (from: string, to: string) => `Show earlier versions (${from} … ${to})`,
    empty: "No banner wished on in this range",
    version: (version: string) => `Version ${version}`,
  },
  history: {
    subtitle: "When each character and weapon was featured, and how long since the last rerun",
    kinds: { characters: "Characters", weapons: "Weapons" },
    kindLabel: "Kind",
    stars: { 5: "5-star", 4: "4-star" },
    starLabel: "Rarity",
    sortLabel: "Sort",
    sorts: { gap: "Longest since featured", recent: "Recently featured", count: "Times featured" },
    head: (kind: string, count: number) => `${kind} · ${count}`,
    count: "Times",
    gap: "Since",
    standard: "Standard",
    current: "Now",
    versions: (count: number) => counted(count, "version"),
    currentVersion: (version: string) => `${version} (current version)`,
    cell: (version: string, first: boolean, second: boolean, unknown: boolean) =>
      [
        version,
        ...(first ? ["featured in the first half"] : []),
        ...(second ? ["featured in the second half"] : []),
        ...(unknown ? ["second half not announced"] : []),
      ].join(" · "),
    owned: "On your account",
    caption: (star: string, kind: string) =>
      `${star} ${kind.toLowerCase()} featured by version, newest on the left`,
    legend: {
      first: "First half",
      second: "Second half",
      unknown: "Not announced",
      owned: "On your account (constellation)",
      note: '"Since" counts the versions since last featured; standard items go last',
    },
    table: "Banner history",
  },
  settings: {
    title: "Wishes",
    autoRead: "Read wish history automatically",
    autoReadHint:
      "While auto sync runs, opening the wish history in the game lets Moongazer read it online from the official service with the temporary key the game sends. The key stays in memory only and is never written to files or logs.",
    hideEmptyHint: "Banners without records are not shown on the wishes page",
    hideNoviceHint: "The Beginners' Wish is not shown on the wishes page",
    saveFailed: "Could not save",
  },
}
