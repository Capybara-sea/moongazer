# Changelog

All notable changes to this project will be documented in this file. A
Chinese version is in [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- After auto sync is first started by hand, Moongazer asks whether to start it with the app.
- About can show the changelog, and the first start after an update shows what changed.

### Changed

- On wide screens the character, weapon, artifact, bag and planner pages fill the window's width.
- The weapon page opens with cards, and its view buttons are in the same order as the character page's.

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

[unreleased]: https://github.com/Capybara-sea/moongazer/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Capybara-sea/moongazer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Capybara-sea/moongazer/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Capybara-sea/moongazer/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Capybara-sea/moongazer/releases/tag/v0.1.0
