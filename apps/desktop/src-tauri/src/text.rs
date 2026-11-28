// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The few user-facing strings the Rust side shows itself, before or without
//! the webview. Like apps/desktop/src/text/, this file may contain Chinese.

use std::sync::atomic::{AtomicBool, Ordering};

pub struct Text {
    pub app_name: &'static str,
    /// After the name in test builds, as on the title bar's badge.
    pub test_build: &'static str,
    pub tray_open: &'static str,
    pub tray_quit: &'static str,
    pub sync: Sync,
    pub pick_data_dir: &'static str,
    pub move_data_failed: &'static str,
    pub fatal_error: &'static str,
    pub webview2_ask: &'static str,
    pub webview2_manual: &'static str,
}

/// Auto sync's state in the tray menu and tooltip.
pub struct Sync {
    pub off: &'static str,
    pub starting: &'static str,
    pub waiting_game: &'static str,
    pub waiting_login: &'static str,
    pub connected: &'static str,
    pub interrupted: &'static str,
    pub connected_short: &'static str,
    pub interrupted_short: &'static str,
}

const ZH: Text = Text {
    app_name: "望月",
    test_build: "测试版",
    tray_open: "打开望月",
    tray_quit: "退出望月",
    sync: Sync {
        off: "自动同步：未开启",
        starting: "自动同步：正在开启",
        waiting_game: "自动同步：等待游戏",
        waiting_login: "自动同步：等待登录",
        connected: "自动同步：已连接",
        interrupted: "自动同步：连接中断",
        connected_short: "已连接",
        interrupted_short: "连接中断",
    },
    pick_data_dir: "选择数据位置",
    move_data_failed: "更改数据位置失败，本次仍使用原位置。\n\n错误信息：",
    fatal_error: "程序发生错误，即将关闭。\n\n\
        请尝试重新打开；如果问题反复出现，请重新安装或下载最新版本。\n\n错误信息：",
    webview2_ask: "此电脑缺少 Microsoft Edge WebView2 运行时\
        （Windows 11 已内置，部分 Windows 10 未安装），程序需要它才能显示界面。\n\n\
        是否立即从微软官网下载并安装？需要联网，安装完成后将自动重新打开本程序。",
    webview2_manual: "自动安装 WebView2 失败。\n\n\
        请从微软官网手动下载并安装，然后重新打开本程序：\n\
        https://developer.microsoft.com/microsoft-edge/webview2/",
};

const EN: Text = Text {
    app_name: "Moongazer",
    test_build: "Test build",
    tray_open: "Open Moongazer",
    tray_quit: "Quit Moongazer",
    sync: Sync {
        off: "Auto sync: off",
        starting: "Auto sync: starting",
        waiting_game: "Auto sync: waiting for the game",
        waiting_login: "Auto sync: waiting for login",
        connected: "Auto sync: connected",
        interrupted: "Auto sync: connection lost",
        connected_short: "Connected",
        interrupted_short: "Connection lost",
    },
    pick_data_dir: "Choose data location",
    move_data_failed: "Could not change the data location; the current location is used \
        for now.\n\nError:",
    fatal_error: "An error occurred and the app will close.\n\n\
        Try opening it again. If the problem keeps occurring, reinstall or download the \
        latest version.\n\nError:",
    webview2_ask: "This PC is missing the Microsoft Edge WebView2 Runtime (built into \
        Windows 11, missing on some Windows 10 PCs), which the app needs to show its \
        window.\n\n\
        Download and install it from Microsoft now? This needs an internet connection; the \
        app reopens when the installation finishes.",
    webview2_manual: "Could not install WebView2 automatically.\n\n\
        Download and install it from Microsoft, then open the app again:\n\
        https://developer.microsoft.com/microsoft-edge/webview2/",
};

static ENGLISH: AtomicBool = AtomicBool::new(false);

/// The strings in the language in use: the system's until the page names one.
pub fn text() -> &'static Text {
    if is_english() { &EN } else { &ZH }
}

/// Whether the language in use is English.
pub fn is_english() -> bool {
    ENGLISH.load(Ordering::Relaxed)
}

/// Chinese on a Chinese system, English on any other, as the page's default.
pub fn init() {
    ENGLISH.store(!crate::win::system_is_chinese(), Ordering::Relaxed);
}

/// Sets the language the page uses; true when it changed.
pub fn set_english(english: bool) -> bool {
    ENGLISH.swap(english, Ordering::Relaxed) != english
}
