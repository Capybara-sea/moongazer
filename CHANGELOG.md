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
  you choose to restart; the portable version announces it and opens the
  download page. Updates stay off until releases are published.
- Portable version: a zip that keeps all settings and data in an `app-data`
  folder next to the program. When the Microsoft Edge WebView2 runtime is
  missing, it offers to download and install it.
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
