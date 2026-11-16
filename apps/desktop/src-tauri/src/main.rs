// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Moongazer desktop app: window, commands and app-level services.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod logging;
mod portable;
mod text;
mod update;
mod webview2;
#[expect(unsafe_code, reason = "MessageBoxW is the app's only FFI call")]
mod win;

use anyhow::Context;
use tauri::window::Color;
use tauri::{Manager, Theme};
use tauri_plugin_decorum::WebviewWindowExt;

/// `--background` of the dark theme in index.css.
const DARK_BACKGROUND: Color = Color(0x14, 0x1c, 0x30, 0xff);

fn main() {
    // Any panic ends the app with a dialog. Most startup failures (the window,
    // the webview, the log directory) are panics inside Tauri, and a panic in
    // a background thread would otherwise leave a half-working app behind.
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        default_hook(info);
        tracing::error!(%info, "panicked");
        // The location is a path on the build machine; it goes to the log only.
        fatal(info.payload_as_str().unwrap_or("unknown error"));
    }));

    if !webview2::check() {
        return;
    }
    let portable_dir = portable::detect();
    let mut context = tauri::generate_context!();
    if let Some(dir) = &portable_dir {
        portable::apply(&mut context, dir);
    }
    let is_portable = portable_dir.is_some();

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(portable::Mode(is_portable))
        .manage(update::Pending::default())
        .setup(move |app| {
            let guard = logging::init(&app.path().app_log_dir()?)?;
            app.manage(guard);
            let window = app
                .get_webview_window("main")
                .context("the main window is missing")?;
            // Frameless window with title bar buttons drawn in the page (see
            // AppShell). Hovering maximize opens Snap Layouts by simulating
            // Win+Z, which the user accepted knowingly.
            window.create_overlay_titlebar()?;
            // The window starts hidden (tauri.conf.json), so with a dark
            // system theme it never shows WebView2's white default.
            if window.theme()? == Theme::Dark {
                window.set_background_color(Some(DARK_BACKGROUND))?;
            }
            window.show()?;
            tracing::info!(
                version = %app.package_info().version,
                portable = is_portable,
                "started"
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update::app_info,
            update::check_update,
            update::download_update,
            update::install_update,
        ])
        .run(context);

    // Only build errors get here (the event loop never returns on Windows).
    if let Err(err) = result {
        fatal(&err.to_string());
    }
}

/// Shows the error and exits. The release build has no console, so the
/// dialog is the only trace the user sees.
fn fatal(detail: &str) -> ! {
    win::error_box(text::APP_NAME, &format!("{}\n{detail}", text::FATAL_ERROR));
    std::process::exit(1)
}
