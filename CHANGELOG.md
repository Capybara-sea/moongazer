# Changelog

All notable changes to this project will be documented in this file. A
Chinese version is in [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Desktop app shell: a home page and an about page with the version.
- Updates, checked at startup and every hour (this can be turned off on the
  about page). The installed version downloads in the background and
  installs on restart without administrator rights; the portable version
  replaces itself. Off until releases are published.
- Portable version: a zip that keeps all data in an `app-data` folder next
  to the program, and offers to install WebView2 when it is missing.
- Importing GOOD and Leyline files into a snapshot history, with what
  changed since the previous snapshot. The newest 100 keep everything;
  older ones keep their totals. A file that looks wrong (fewer characters,
  far fewer weapons or artifacts, another account) is saved only after you
  confirm. Items newer than the app's game data show as not yet updated.
- Settings page: data folder, theme, glass look and motion.
- Account overview, laid out like Teyvat.me's: account card, totals, daily
  tasks, Spiral Abyss, Imaginarium Theater, Stygian Onslaught, exploration
  and collections, and Mora and Primogem history. Most of it needs a
  Leyline file from Teyvat.me Capture.
- Characters page as cards or a list, with filters and sorting. The details
  show talents and constellations (described on hover), weapon, artifacts,
  panel stats worked out from game data, and changes since the previous
  snapshot.
- Weapons, artifacts and materials pages with filters; materials show their
  change since the previous snapshot.
- Artifact set effects on hover.
- When a GOOD snapshot is picked, the pages show the newest earlier Leyline
  snapshot instead.
- Game icons, downloaded from Enka.Network or Project Amber when first shown
  and kept on disk.
- Message center behind a bell in the title bar: reminders worked out from
  the newest Leyline snapshot (Original Resin, expeditions, commissions,
  Spiral Abyss resets and more) and new versions.
- Windows notifications for reminders while the app is in the background;
  clicking one on screen opens its page. They can be turned off.
- Tray icon: closing the window keeps the app running in the tray, and
  starting it again brings it back.
- Light, dark and system themes.
- App logo and icons.
- Interface motion for themes, page switches and the side menu, off when
  Windows turns animations off.

[unreleased]: https://github.com/Capybara-sea/moongazer/commits/main
