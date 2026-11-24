<div align="center">

**English** · [简体中文](README.zh-CN.md)

<img src="assets/logo/logo-animated.svg" width="112" height="112" alt="Moongazer logo">

# Moongazer

The sea of stars is boundless, and we are not alone.

View your Genshin Impact characters, weapons, artifacts, inventory and achievements on your PC, and work out the materials you need to level them up.

### [Download the latest version](https://github.com/Capybara-sea/moongazer/releases/latest)

Windows 10/11 (64-bit) · Free · Simplified Chinese interface · Early development

</div>

<img src="assets/screenshots/preview.webp" alt="The account overview, characters and a character's details">

<sub>Screenshots use test data.</sub>

## Features

- **Overview** (总览): daily tasks (Original Resin, Daily Commissions, Realm Currency and more), Spiral Abyss and other challenge progress, Mora and Primogem trends, and the changes from each login.
- **Characters, weapons, artifacts and inventory**: synced automatically, with filters.
- **Collection** (收集): achievements and anecdotes.
- **Planner** (规划): set goals for characters and weapons, and see the missing materials and what to craft first.
- **Reminders**: Original Resin full, expeditions complete, commission rewards unclaimed, Spiral Abyss about to reset and more; also sent as Windows notifications while Moongazer runs in the background.
- **Multiple accounts**, switched automatically when you log in to the game.
- Planned: artifact optimizer, Serenitea Pot set reward checklist, more languages.

## Before you start

- Requires 64-bit Windows 10 or 11, with the PC version of Genshin Impact running on the same computer. Mobile, cloud and console versions cannot be synced. Auto sync has so far been tested only with the Chinese (mainland) PC client.
- No HoYoLAB, miHoYo or other login is required. Account data is stored only on this computer; Moongazer goes online only to check for updates and to download game icons.
- Auto sync requires administrator rights, and Windows asks for confirmation each time it starts. Auto sync only reads the game's network traffic; it never sends anything to the game and never modifies game files. Moongazer is an unofficial tool, used at your own risk.

## Download and installation

1. Open the [download page](https://github.com/Capybara-sea/moongazer/releases/latest) (no GitHub account required). Do not use the green **Code** button on the repository's front page: it downloads the source code, which cannot be run directly.
2. Scroll down to **Assets** and download one of the two versions. Both have the same features; if unsure, choose the installer.

   |               | Installer (recommended)                                | Portable                                                       |
   | ------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
   | File          | Name ends in `setup.exe`                               | Name ends in `portable.zip`                                    |
   | How to start  | Run the installer; no administrator rights required    | Extract, then run `Moongazer.exe`                              |
   | Data location | Your user's AppData folder; can be changed in Settings | The `app-data` folder next to the program                      |
   | Updates       | Automatic                                              | Automatic (the folder must be writable)                        |
   | Uninstalling  | Through Apps in Windows Settings                       | Delete the whole folder, data included                         |
   | Suitable for  | Most users                                             | Using without installing, or from another drive or a USB stick |

   The other files under Assets (`.sig`, `latest.json`, `SHA256SUMS.txt`, `THIRD_PARTY_NOTICES.txt`, Source code) are not needed. If the page does not load or the download is slow, try again later.
3. The following warnings may appear while downloading and running it, because Moongazer has no digital signature:
   - The browser reports that the file is not commonly downloaded: choose **Keep** in the downloads list (Edge asks again; click **Show more** → **Keep anyway**).
   - Running setup.exe or the extracted `Moongazer.exe` shows a blue "Windows protected your PC" box: after confirming the file came from the download page above, click **More info** → **Run anyway**.

   Windows 11 with Smart App Control turned on blocks it outright, without a **Run anyway** option, and Moongazer cannot be used. To check whether it is on, search the Start menu for "Smart App Control".
4. Installer: run setup.exe, choose a language and click **Next** to finish. In the Start menu it is named **Moongazer**.\
   Portable: right-click the zip file and choose **Extract All**, then run `Moongazer.exe` in the extracted `Moongazer` folder. Do not delete the `portable` file next to it (it keeps the data in the program's folder), and do not place the folder where writing needs administrator rights, such as `C:\Program Files`.

## First use

The interface is in Chinese; the labels in brackets are the ones shown on screen.

1. Open Moongazer and click **Start sync** (开始同步) on the home page (首页).
2. Windows asks "Do you want to allow this app from an unknown publisher to make changes to your device?"; click **Yes**. Reading network data requires administrator rights, which only the separate sync helper (同步助手) started by Moongazer uses. The prompt is yellow, again because there is no digital signature. It appears every time sync starts.
3. Start Genshin Impact and enter Teyvat. Moongazer reads the account data automatically and records changes during play as they happen.\
   If you were already in the game when sync started, return to the title screen and enter again.
4. Before each later session, open Moongazer and start sync: click **Auto sync off** (自动同步未开启) at the bottom left, then **Turn on auto sync** (开启自动同步). After sync is first started, Moongazer asks whether to start it whenever Moongazer opens; choose **Start automatically** (自动开启) to skip this step. This can be changed later in Settings (设置).

Closing the window does not quit Moongazer: it stays in the tray at the bottom right of the taskbar (click the ^ arrow there if the icon is not shown), as reminders and sync need it running. To quit, right-click the tray icon and choose **Quit Moongazer** (退出望月). Moongazer does not start with Windows.

As an alternative to auto sync, you can import a Leyline file (.json) exported by [Teyvat.me Capture](https://github.com/tawan475/teyvat.me-capture): click **Import file** (导入文件) on the Overview (总览) page. If you have not used Teyvat.me Capture, skip this.

## Updating

Moongazer checks for new versions and downloads them in the background. When **Restart to update** (重启更新) appears, click it to finish updating. You can also click **Check for updates** (检查更新) on the About (关于) page. After a game update, if Moongazer reports that it needs updating, update Moongazer first.

If an automatic update fails, update manually. Installer: run the new setup.exe and, on the "already installed" page, choose **Do not uninstall**. Portable: quit Moongazer, then replace `Moongazer.exe` with the one from the new zip, keeping the `app-data` folder. Your data is kept either way.

## Uninstalling

- Installer: first right-click the tray icon and choose **Quit Moongazer** (退出望月), then find **Moongazer** under Apps in Windows Settings and uninstall it. The uninstaller offers a "Delete the application data" option, unticked by default; if it stays unticked, your account data is kept.
- Portable: quit Moongazer and delete the whole folder; the data is deleted with it.

## FAQ

<details>
<summary>Where is the data stored? How do I back it up or move it to a new PC?</summary>

In Moongazer, go to Settings (设置) → Data (数据) and click **Open folder** (打开文件夹). Quit Moongazer and copy the whole folder to make a backup. To move to a new PC, install Moongazer there, open its data folder the same way, quit Moongazer and replace that folder with your backup. The installed version can also change its data location here.

</details>

<details>
<summary>Why do some cards show no data?</summary>

Auto sync can only read what the game sends. Stygian Onslaught records, for example, are only available after you open its menu in the game.

</details>

<details>
<summary>What if my antivirus warns about it or blocks it?</summary>

Moongazer has no digital signature, and its sync helper reads network data with administrator rights, so some antivirus programs may warn about it. Whether to allow it is your decision; you can verify the file first as described below.

</details>

<details>
<summary>How can I verify that the downloaded file has not been modified? (advanced, optional)</summary>

In the folder containing the file, hold Shift, right-click an empty area and choose **Open in Terminal** (or **Open PowerShell window here**), then run:

```powershell
Get-FileHash .\Moongazer*
```

Compare the Hash shown with the value starting with sha256: next to that file on the download page (the button beside it copies the value; letter case does not matter). If they match, the file is the one released. With the [GitHub CLI](https://cli.github.com) installed and signed in, you can also run `gh attestation verify file-name --repo Capybara-sea/moongazer` to confirm it was built by this repository's GitHub Actions.

</details>

## Community and feedback

Questions and suggestions are welcome in the QQ group 90376195 ([join](https://qm.qq.com/q/knbjLmXja0)), in Chinese, or in [Issues](https://github.com/Capybara-sea/moongazer/issues) with a GitHub account.

## Building from source (for developers)

Requirements: Windows 10/11 x64, Rust stable (1.100+), Node.js 24, pnpm (the version in `package.json` is picked up automatically), cargo-deny and 7-Zip (on PATH or in its default folder).

```sh
pnpm install --frozen-lockfile   # also installs the Git hooks
cargo xtask gen-data             # game data and the UI font the frontend imports (not in git)
cargo xtask check                # everything CI runs
pnpm --filter @moongazer/desktop tauri dev
```

## Acknowledgments

- [Teyvat.me Capture](https://github.com/tawan475/teyvat.me-capture): the Leyline format and the decoding behind auto sync.
- [DimbreathBot/AnimeGameData](https://github.com/DimbreathBot/AnimeGameData): game data.
- [Snap.Metadata](https://github.com/SnapHutaoRemasteringProject/Snap.Metadata): game data.
- [Genshin Optimizer](https://github.com/frzyc/genshin-optimizer): the GOOD format, which Leyline builds on. Data generation checks item keys against it; the program includes none of its data.
- [Enka.Network](https://enka.network) and [Project Amber](https://gi.yatta.moe): game icons.
- [Sarasa Gothic](https://github.com/be5invis/Sarasa-Gothic): the UI font, under the SIL Open Font License 1.1.
- [原神游逸旅闻](https://www.bilibili.com/toy/genshin-travelers-tales) by Bilibili creator 栖霆杨: where each anecdote is met, what brings the hidden ones on and what comes first; drawn on with the author's permission.

## License

The code is released under the [MIT](LICENSE) license. The logo and app icons are not; all rights are reserved. That covers `assets/logo/`, the icons generated from it in `apps/desktop/src-tauri/icons/` and the logo shown inside the app. Forks that publish builds must replace them with their own.

[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) covers the third-party code adapted into this repository, and the font (SIL Open Font License 1.1, not MIT), game keys and game data the released program carries. The full list of what ships inside the program is on the app's About page. The game's keys and data are not covered by the MIT license.

## Disclaimer

Moongazer is an unofficial fan-made tool. It is not affiliated with, endorsed by or sponsored by COGNOSPHERE PTE. LTD. (HoYoverse) or miHoYo. Genshin Impact and the names, images and data from the game are trademarks or copyrights of COGNOSPHERE PTE. LTD. and miHoYo. This repository holds no game art, fonts or game data tables; the released program contains text and numbers taken from the game's data.
