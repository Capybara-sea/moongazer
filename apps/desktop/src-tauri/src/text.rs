// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The few user-facing strings the Rust side shows itself, before or without
//! the webview. Like apps/desktop/src/text/, this file may contain Chinese.

pub const APP_NAME: &str = "望月";

pub const TRAY_OPEN: &str = "打开望月";
pub const TRAY_QUIT: &str = "退出望月";

/// Auto sync's state in the tray menu and tooltip.
#[cfg(feature = "capture")]
pub mod sync {
    pub const OFF: &str = "自动同步：未开启";
    pub const STARTING: &str = "自动同步：正在开启";
    pub const WAITING_GAME: &str = "自动同步：等待游戏";
    pub const WAITING_LOGIN: &str = "自动同步：等待登录";
    pub const CONNECTED: &str = "自动同步：已连接";
    pub const INTERRUPTED: &str = "自动同步：连接中断";
    pub const CONNECTED_SHORT: &str = "已连接";
    pub const INTERRUPTED_SHORT: &str = "连接中断";
}

pub const PICK_DATA_DIR: &str = "选择数据位置";
pub const MOVE_DATA_FAILED: &str = "没能更改数据位置，这次仍用原来的位置。\n\n错误信息：";

pub const FATAL_ERROR: &str = "程序出错，需要关闭。\n\n\
    可以试试重新打开；如果反复出现，请重新安装或下载最新版本。\n\n错误信息：";

pub const WEBVIEW2_ASK: &str = "这台电脑缺少 Microsoft Edge WebView2 运行时\
    （Windows 11 自带，部分 Windows 10 没有），程序需要它才能显示界面。\n\n\
    现在从微软官网下载并安装吗？需要联网，装好后会自动重新打开本程序。";

pub const WEBVIEW2_MANUAL: &str = "没能自动安装 WebView2。\n\n\
    请从微软官网手动下载安装后，再重新打开本程序：\n\
    https://developer.microsoft.com/microsoft-edge/webview2/";
