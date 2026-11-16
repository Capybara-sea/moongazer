// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * Every user-facing string of the web UI. Besides this directory, the
 * repository guard allows Chinese text only in src-tauri/src/text.rs, the
 * README and CHANGELOG.zh-CN.md.
 */
export const text = {
  appName: "望月",
  appNameLatin: "Moongazer",
  nav: {
    home: "首页",
    about: "关于",
  },
  theme: {
    toggle: "切换主题",
    light: "明亮模式",
    dark: "暗黑模式",
    system: "跟随系统",
  },
  home: {
    title: "欢迎使用望月",
    body: "本地、离线查看自己的原神账号数据。目前是第一个版本，只有程序外壳和更新检查。",
    nextTitle: "接下来",
    next: [
      "导入 GOOD / Leyline 文件，保存快照历史",
      "账号数据页面",
      "练度统计",
      "登录时自动读取账号数据",
    ],
  },
  about: {
    tagline: "本地、离线查看自己的原神账号数据。",
    version: "版本",
    mode: "运行方式",
    installed: "安装版",
    portable: "便携版",
    license: "许可证",
    disclaimer: "非官方工具，与 HoYoverse、米哈游、Teyvat.me 均无关联。",
  },
  update: {
    title: "更新",
    hint: "安装版发现新版本会在后台下载好，重启就能用上；便携版只提示新版本，并打开下载页面。",
    check: "检查更新",
    checking: "正在检查…",
    upToDate: "已是最新版本",
    available: (version: string) => `发现新版本 ${version}`,
    downloading: (version: string) => `正在下载新版本 ${version}`,
    ready: (version: string) => `新版本 ${version} 已下载好，重启就能用上`,
    restarting: "正在重启…",
    restart: "重启更新",
    openPage: "打开下载页面",
    disabled: "这个版本没有启用自动更新，请手动下载新版本。",
    failed: "更新失败",
    downloadFailed: "新版本没下载成功",
    loadFailed: "读取程序信息失败",
    autoCheck: "启动时自动检查更新",
    autoCheckHint: "启动时和之后每小时联网查一次有没有新版本。关掉后只在点“检查更新”时才查。",
    readyTitle: "新版本已准备好",
    readyToast: (version: string) => `${version} 已在后台下载好，重启望月就能用上。`,
    portableToast: "便携版要手动下载，替换现在的程序。",
    openPageShort: "打开下载页",
    failedToast: "可能是网络问题，之后检查更新时会再试。",
    retry: "重试",
    later: "稍后",
  },
} as const
