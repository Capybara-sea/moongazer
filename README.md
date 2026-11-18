# 望月（moongazer）

本地、离线的原神账号工具，Windows 桌面应用。已经能导入 Leyline 文件（Teyvat.me Capture 导出的），也能在登录游戏时自动同步账号数据（玩的时候的变化带时间记下）；保存快照历史，支持多个账号，并查看账号总览（账号信息、日常、挑战、探索、摩拉原石走势）、角色、武器、圣遗物和材料。

目前处于开发早期，还没有可用的版本。

A local, offline Genshin Impact account viewer for Windows. It imports Leyline files (as Teyvat.me Capture exports them) and syncs account data while you play the game (every change kept with its time), keeps a snapshot history for one or more accounts and shows an account overview (account, daily tasks, challenges, exploration, Mora and Primogem history), characters, weapons, artifacts and materials. It is in early development and has no usable release yet.

## 开发 / Development

Requirements: Windows 10/11 x64, Rust stable (1.100+), Node.js 24, pnpm (the version in `package.json` is picked up automatically) and cargo-deny.

```sh
pnpm install --frozen-lockfile   # also installs the Git hooks
cargo xtask gen-data             # game name table the frontend imports (not in git)
cargo xtask check                # everything CI runs
pnpm --filter @moongazer/desktop tauri dev
```

## 许可证 / License

代码以 [MIT](LICENSE) 许可证发布，只覆盖本仓库的代码。

The code is released under the [MIT](LICENSE) license, which covers the code in this repository only.

## 声明 / Disclaimer

本项目是非官方的爱好者工具，与 HoYoverse、米哈游、Teyvat.me 均无关联。

This is an unofficial fan-made tool, not affiliated with or endorsed by HoYoverse, COGNOSPHERE PTE. LTD., miHoYo, or Teyvat.me. Genshin Impact and all related names and assets are the property of their respective owners.
