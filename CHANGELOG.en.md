# Changelog

All notable changes to this project will be documented in this file. The
Chinese version is [CHANGELOG.md](CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- English interface: switch between Simplified Chinese and English in Settings (the first run
  follows the system language). Game content such as characters, items, achievements and
  anecdotes uses the official English names, and the tray menu and update notes follow too.
- The account list in the side panel can delete an account, with its snapshots, sync
  timelines, planner and tasks; the one auto sync is reading cannot be deleted.

### Fixed

- Text in the auto sync panel no longer jumps when the pointer moves over it.
- Auto sync now links Teyvat.me Capture v1.18.5: Bilibili server accounts are expected to be read
  too (not yet tested); the UID comes from the game's login reply first; in another player's
  world, the host's boss data is no longer taken as your own.

## [0.3.5] - 2026-11-26

### Added

- The collection has furnishing sets (the companions' primogems left to claim, and a list of the
  furnishings those sets need with what the bag lacks and how to get it) and spincrystals by
  area. Auto sync now reads the furnishings in the bag.

## [0.3.4] - 2026-11-25

### Added

- Home turns to the game: time to the resets and the next version, the newest snapshot with the
  tasks left, time played as auto sync saw it, and a calendar of the version.
- The overview has a to-do card (battle pass, reputation, shop, Adventure Rank rewards, events and
  custom tasks, ticked by themselves where the snapshot tells) and where to spend resin, a place a
  row in order of priority with what is short there.
- The planner lists up to five goals whose next step has its materials, with what to combine or
  convert first.

### Changed

- Hovering a material in the planner's summary or today list also shows each combining or
  converting step with icons, added up over all goals, and no longer what the bag holds.
- Section titles on the overview sit inside their cards, each card's title on one line at one
  size.
- The achievements page drops the title over the list; in a wide enough window the goals and the
  achievements scroll each on their own.

### Fixed

- Weekly boss discounts in Leyline files from Teyvat.me Capture 1.13.2 and earlier are no longer
  read the wrong way round.
- With auto sync, the list of running events no longer drops to one when a single event moves on
  (spending resin on the weekly training event, trying a trial character).
- Paimon's Bargains carry over from the last time the shop was read, so a new login no longer shows
  them as not read.

## [0.3.3] - 2026-11-24

### Changed

- Hovering a planner material shows what there is for that goal of what it needs, then each
  combining or converting step with icons and what is still needed after them.
- The planner's summary keeps what converting makes up, and what it costs, when showing only what
  is short; weekly boss materials come before world boss ones.

### Fixed

- The planner's note on the event that opens every domain uses the event's name in the Chinese
  client.

## [0.3.2] - 2026-11-23

### Added

- The achievements page can sort by finish time, the latest first.
- Auto sync notes which twin the Traveler is, and the pages show the Traveler with that portrait.

### Changed

- The daily card estimates when Realm Currency will be full from the Adeptal Energy, and counts it
  up over time.
- The planner's material cells say what is short, or once there is enough, what is needed, in grey,
  and fade.
- Right-clicking in the app no longer opens the browser's menu, except in text fields.
- The UI font is now Sarasa Gothic, with Segoe UI for digits; semibold titles and names no longer
  show as bold.
- Status colors are one set across the app: green for done and gains, amber for warnings, red for
  errors, shortages and losses. Errors and shortages read better in the dark theme, green and amber
  text in the light theme.

## [0.3.1] - 2026-11-23

### Added

- After auto sync is first started by hand, Moongazer asks whether to start it with the app.
- About can show the changelog, and the first start after an update shows what changed.
- The planner can count on converting spare element gems and weekly boss materials, each with its
  own switch in the planner's settings; it shows what is converted and the Dust of Azoth or Dream
  Solvent spent.
- The overview's challenges are marked done at full stars, or for Stygian Onslaught a full clear.
- Each anecdote's tips have a "Video guide" link that searches Bilibili for the guide author's
  video.
- Hovering a planner material also shows how many the bag holds in all, before the goals share it.

### Changed

- On wide screens the character, weapon, artifact, bag and planner pages fill the window's width.
- The weapon page opens with cards, and its view buttons are in the same order as the character page's.
- The planner's material icons are larger and closer together.
- Adding a goal leaves out what is already planned, and owned weapons show their refinement.
- Adding a goal lists owned characters and weapons by level, highest first.
- On the daily card, the notes for resin, the realm currency and the transformer sit under their
  values, leaving just the bar in the middle.

### Fixed

- Dropdown menus are translucent like the other popups, and the planner's priority switch looks like
  the ones in Settings.
- Picking an area on the anecdotes page lists only the characters with anecdotes there, with that
  area's counts.
- The add goal dialog and the achievements page's category column keep their size while searching
  or filtering.
- The overview's progress bars are one thickness and the daily card's line up; bar tracks show
  clearly in the light theme.
- In the light theme, borders, boxes inside cards, toggle groups, tags and element icons show
  clearly, and green and amber text is easier to read.
- The artifact and weapon icons on a character's page are colored by rarity, as on their own pages.

## [0.3.0] - 2026-11-22

### Added

- A Planner page under a new Growth group: goals for characters and weapons, what they still need
  from the bag in card order, and what can be raised now; ones not out yet can be planned too.

### Changed

- Hidden achievements show their description too, finished or not.
- Settings can write large numbers in K, M and B instead of the Chinese units.
- Hover tips use the app's own popup instead of the system's.
- Icons sit on the game's rarity colors, easier to tell apart.

### Fixed

- The overview's daily card no longer says "not read" for full resin, reads finished commissions
  on more days, with or without a fixed commission region, and follows them as they are done;
  when it still cannot, hovering the row says what to do.
- Auto sync now links Teyvat.me Capture v1.18.4: spending all resin no longer leaves the old count,
  and the UID, weekly boss discounts and the Aranara list are no longer lost in some cases.

## [0.2.0] - 2026-11-21

### Added

- A Collection page in the side menu, also opened from the overview's anecdotes card.
- Achievements: by category and series, with the game's category icons, counts, primogems and
  versions, and a Bilibili video search for each; unfinished hidden ones keep their description
  covered and can be left out.
- Anecdotes: by character and area, with places, how hidden ones come and what comes first,
  seals, the fewest days the rest take, and a note when the seal reward waits to be claimed.

### Changed

- The account and auto sync share one block at the bottom of the side menu; the theme is set
  in Settings.

### Fixed

- The overview counts 156 anecdotes (155 without Lauma) instead of 161, and says new ones wait
  until the seal reward is claimed.
- Before the first snapshot, the home page shows auto sync's stage once it is on, and the pages
  no longer suggest turning it on again.

## [0.1.1] - 2026-11-21

### Added

- The installed build can move its data to another folder in Settings, and back.
- Restarting while auto sync is connected asks first: syncing resumes after you
  return to the title screen and enter again.
- About and the READMEs link to the QQ group (90376195).

### Changed

- The ascension star no longer shows on a character at level 90/90.
- The home page opens with three lines from the letter under the welcome, and
  without data puts "Start sync" first, with importing a file below.

### Fixed

- Icons with transparent parts no longer show a letter behind them.
- Waiting long at the title screen no longer reads as an outdated Moongazer.

## [0.1.0] - 2026-11-20

### Added

- Account overview, characters, weapons, artifacts and inventory pages; the
  lists have filters.
- Importing Leyline files as snapshots, with what changed since the previous
  one; a file that looks wrong is saved only after you confirm.
- Auto sync while you play: a snapshot at each login and a timeline of what
  changed.
- Several accounts, switched in the side menu, or by auto sync at login.
- A message center for updates and auto sync's messages, Windows
  notifications when auto sync has a problem, and a tray icon.
- An installer and a portable zip; updates download in the background and
  go in when you restart from the app.
- Settings page, light and dark themes, animations, and game icons that
  download when first shown.
- About page with help and feedback, acknowledgments and third-party
  licenses.

[unreleased]: https://github.com/Capybara-sea/moongazer/compare/v0.3.5...HEAD
[0.3.5]: https://github.com/Capybara-sea/moongazer/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/Capybara-sea/moongazer/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/Capybara-sea/moongazer/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/Capybara-sea/moongazer/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/Capybara-sea/moongazer/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Capybara-sea/moongazer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Capybara-sea/moongazer/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Capybara-sea/moongazer/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Capybara-sea/moongazer/releases/tag/v0.1.0
