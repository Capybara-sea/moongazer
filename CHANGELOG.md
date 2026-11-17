# Changelog

All notable changes to this project will be documented in this file. A
Chinese version is in [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Desktop app shell with a home page and an about page showing the version
  and whether the app runs installed or portable.
- Updates. The app checks for a new version at startup and then every hour
  (this can be turned off on the about page). The installed version downloads
  it in the background and installs it, without administrator rights, when
  you choose to restart; the portable version replaces itself the same way,
  or, kept in a folder it cannot write to, opens the download page. Updates
  stay off until releases are published.
- Portable version: a zip that keeps all settings and data in an `app-data`
  folder next to the program. When the Microsoft Edge WebView2 runtime is
  missing, it offers to download and install it.
- Importing GOOD and Leyline files (from Teyvat.me Capture and other tools)
  on a new account overview page, several at a time. Each import is kept as a
  snapshot, listed with what changed since the one before. The newest 100
  keep everything; older ones keep their time, counts, Mora and Primogems for
  good. A file that looks wrong next to the snapshot before it (fewer
  characters, over a fifth fewer weapons or artifacts, or another account)
  is saved only after you confirm, and the same content is never saved
  twice. Items newer than the app's game data are listed as not yet updated.
- Settings page: where the data is kept, with a button to open the folder;
  the theme; and switches for the glass look and for motion.
- The account overview, laid out like Teyvat.me's: the account card, on the
  player's name card art and with their profile frame (UID hidden until you
  show it); totals with their change since the previous snapshot; today's
  tasks (Original Resin, commissions, Realm Currency, weekly boss discounts,
  expeditions, the Parametric Transformer and the Blessing of the Welkin
  Moon, carried forward to the current time); the running Spiral Abyss with
  its Blessing of the Abyssal Moon (the effect shows when the pointer rests
  on it), Imaginarium Theater with the season's elements, special guest
  stars and opening characters and which acts earned a star, and Stygian
  Onslaught; exploration per region (estimated), anecdotes and collections;
  Mora and Primogem charts by snapshot, hour, day, month or year; and a table
  by month. Any snapshot whose full data is kept can be picked. Everything
  but the totals and the history needs a Leyline file from Teyvat.me Capture.
  Snapshots now also count 4- and 3-star artifacts and Sanctifying Essence;
  older ones get them from their kept data.
- Characters page: every character as a card (level, constellation,
  friendship, talent levels with the constellation bonus, weapon and
  artifact sets) or in a list, filtered by element (shown by its icon) or
  name and sorted by level, rarity or constellation. A card or row opens the
  character's details: level and ascension, friendship and when they
  joined, constellations, talents by name and passive talents (each with
  its description on hover), weapon, artifacts with their main stat values,
  the panel stats worked out from game data (base stats, weapon, artifact
  main stats and substats, and 2-piece set bonuses; weapon passives,
  talents, constellations and 4-piece effects are left out), and what
  changed since the previous snapshot. The characters total on the overview
  opens the page.
- Weapons page: every weapon in a table or as cards, with its type, rarity,
  level, refinement, wielder and lock, filtered by type or to unequipped
  weapons and sorted by rarity, level or refinement. The weapons total on
  the overview opens it.
- Artifacts page: every artifact as a card with its set, slot, level, main
  stat value, substats (including ones not yet active), wielder, star mark,
  lock, Sanctifying Elixir and roll count, filtered by slot, set (each
  listed with its icon and how many you have) or to unequipped ones. Cards
  load in batches as you scroll. The artifact totals on the overview open
  it.
- Materials page, in the side menu: every material as a card with its
  count and its change since the previous snapshot, in seven tabs
  (development, currency, local specialties, food, materials, items, quests
  and other) and within a tab grouped by its type in the game data,
  searchable by name and filtered to those that changed; each tab shows how
  many it holds. Materials used up since then are listed with 0. Cards load
  in batches as you scroll.
- Resting the pointer on an artifact set (its icon on character cards and
  rows and on artifact cards, or the set in a character's details) shows
  the set's effects; for a character, effects that need more pieces than
  they wear are muted.
- When a GOOD snapshot is picked, every page shows the newest earlier
  Leyline snapshot in its place, and the overview's totals say which one;
  the GOOD file itself counts only in the snapshot history.
- Game icons, downloaded when first shown from Enka.Network or Project Amber
  and kept in the data folder.
- Light, dark and system themes.
- App logo and icons.
- Interface motion: a new theme spreads out from the theme button as a soft
  circle; when switching pages the old page drops back out of focus while the
  new page's cards rise into focus one after another; the side menu
  highlight slides to the selected item; the background glow drifts slowly;
  the About page logo plays a short intro; while checking for updates, the
  arrow on the button turns.
  Nothing moves when animations are turned off in Windows.

[unreleased]: https://github.com/Capybara-sea/moongazer/commits/main
