<img src="assets/logo/logo-animated.svg" width="112" height="112" alt="Moongazer logo">

# Moongazer

**English** · [简体中文](README.zh-CN.md)

The sea of stars is boundless, and we are not alone.

A Traveler's journal for Windows, in early development. The interface is in Simplified Chinese only for now; more languages will follow.

<img src="assets/screenshots/preview.webp" alt="The account overview, characters and a character's details">

<sub>Screenshots use test data.</sub>

## Features

- An account overview with daily tasks, Spiral Abyss, and Mora and Primogem trends.
- Characters, weapons, artifacts and inventory synced automatically and easy to browse.
- Several accounts.
- Imports Leyline files (account exports in JSON).
- Level-up planner (which materials you still need) — _TODO_
- Artifact optimizer — _TODO_
- Anecdote checklist — _TODO_
- Achievement checklist — _TODO_
- Serenitea Pot set reward checklist — _TODO_
- Reminders: Original Resin full, expeditions done, commission rewards unclaimed, Spiral Abyss about to reset and more — _TODO_
- More languages — _TODO_

Auto sync only receives data: it never sends anything to the game or changes its files. Use it at your own risk.

## Download

Download from [Releases](https://github.com/Capybara-sea/moongazer/releases):

- `Moongazer_<version>_x64-setup.exe`: the installer.
- `Moongazer_<version>_x64-portable.zip`: the portable version.

## Usage notes

The first time you run the installer or the program, Windows may show "Windows protected your PC". If the file came from this repository's Releases, click **More info**, then **Run anyway**. Windows 11 with Smart App Control turned on blocks them outright, with no such option.

To check a download first, run `Get-FileHash <file>` in PowerShell and compare it with `SHA256SUMS.txt` from the release. With the GitHub CLI you can also run `gh attestation verify <file> --repo Capybara-sea/moongazer`.

The installer needs no administrator rights. By default it installs to `%LOCALAPPDATA%\Moongazer`, which you can change during setup, and keeps data in `%LOCALAPPDATA%\io.github.capybara-sea.moongazer`.

Turning on auto sync shows a UAC prompt. It is yellow and shows an unknown publisher because the program is not signed. Without auto sync there is no UAC prompt.

## Development

Requirements: Windows 10/11 x64, Rust stable (1.100+), Node.js 24, pnpm (the version in `package.json` is picked up automatically) and cargo-deny.

```sh
pnpm install --frozen-lockfile   # also installs the Git hooks
cargo xtask gen-data             # game data the frontend imports (not in git)
cargo xtask check                # everything CI runs
pnpm --filter @moongazer/desktop tauri dev
```

## Acknowledgments

- [Teyvat.me Capture](https://github.com/tawan475/teyvat.me-capture): the Leyline format and the decoding behind auto sync.
- [DimbreathBot/AnimeGameData](https://github.com/DimbreathBot/AnimeGameData): game data.
- [Snap.Metadata](https://github.com/SnapHutaoRemasteringProject/Snap.Metadata): game data.
- [Genshin Optimizer](https://github.com/frzyc/genshin-optimizer): the GOOD format, which Leyline builds on. Data generation checks item keys against it; the program includes none of its data.
- [Enka.Network](https://enka.network) and [Project Amber](https://gi.yatta.moe): game icons.
## License

The code is released under the [MIT](LICENSE) license. The logo and app icons are not; all rights are reserved. That covers `assets/logo/`, the icons generated from it in `apps/desktop/src-tauri/icons/` and the logo shown inside the app. Forks that publish builds must replace them with their own.

[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) covers third-party code adapted into this repository, and the game's keys and data the released program carries. The full list of what ships inside the program is on the app's About page. The game's keys and data are not covered by the MIT license.

## Disclaimer

Moongazer is an unofficial fan-made tool. It is not affiliated with, endorsed by or sponsored by COGNOSPHERE PTE. LTD. (HoYoverse) or miHoYo. Genshin Impact and the names, images and data from the game are trademarks or copyrights of COGNOSPHERE PTE. LTD. and miHoYo. This repository holds no game art, fonts or game data tables; the released program contains text and numbers taken from the game's data.
