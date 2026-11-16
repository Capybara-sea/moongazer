# 望月（moongazer）

本地、离线的原神账号工具，Windows 桌面应用。计划中的功能：导入账号文件并保存快照历史、账号数据页面、练度统计，以及登录时自动读取账号数据。

目前处于开发早期，还没有可用的版本。

A local, offline Genshin Impact account viewer for Windows. Planned: importing account files with snapshot history, account pages, build progress statistics, and reading account data at login. It is in early development and has no usable release yet.

## 开发 / Development

Requirements: Windows 10/11 x64, Rust stable (1.100+), Node.js 24, pnpm (the version in `package.json` is picked up automatically) and cargo-deny.

```sh
pnpm install --frozen-lockfile   # also installs the Git hooks
cargo xtask check                # everything CI runs
pnpm --filter @moongazer/desktop tauri dev
```

## 许可证 / License

代码以 [MIT](LICENSE) 许可证发布，只覆盖本仓库的代码。

The code is released under the [MIT](LICENSE) license, which covers the code in this repository only.

## 声明 / Disclaimer

本项目是非官方的爱好者工具，与 HoYoverse、米哈游、Teyvat.me 均无关联。

This is an unofficial fan-made tool, not affiliated with or endorsed by HoYoverse, COGNOSPHERE PTE. LTD., miHoYo, or Teyvat.me. Genshin Impact and all related names and assets are the property of their respective owners.
