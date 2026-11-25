// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Moongazer desktop app: window, commands and app-level services.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod background;
#[cfg(feature = "capture")]
mod capture;
mod data_location;
mod icons;
mod logging;
mod planner;
mod portable;
mod snapshots;
mod tasks;
mod text;
mod update;
mod webview2;
#[expect(
    unsafe_code,
    reason = "the app's one Windows FFI module: dialogs, and auto sync's elevation and pipes"
)]
mod win;

use anyhow::Context;
use tauri::window::Color;
use tauri::{Manager, Theme};
use tauri_plugin_decorum::WebviewWindowExt;

/// `--background` of the dark theme in index.css.
const DARK_BACKGROUND: Color = Color(0x14, 0x1c, 0x30, 0xff);

fn main() {
    // The elevated capture mode is this exe too, and branches off before
    // anything of the app's own runs.
    #[cfg(feature = "capture")]
    if let Some(code) = capture::helper::run_if_asked() {
        std::process::exit(code);
    }

    // Any panic ends the app with a dialog. Most startup failures (the window,
    // the webview, the log directory) are panics inside Tauri, and a panic in
    // a background thread would otherwise leave a half-working app behind.
    // Only decoding may fail alone: auto sync then shows it as interrupted.
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        default_hook(info);
        #[cfg(feature = "capture")]
        if std::thread::current().name() == Some(capture::DECODER_THREAD) {
            tracing::error!(
                message = info.payload_as_str().unwrap_or(""),
                "decoding panicked"
            );
            return;
        }
        tracing::error!(%info, "panicked");
        // The location is a path on the build machine; it goes to the log only.
        fatal(info.payload_as_str().unwrap_or("unknown error"));
    }));

    if !webview2::check() {
        return;
    }
    let portable_dir = portable::detect();
    let mut context = tauri::generate_context!();
    let location = match &portable_dir {
        Some(dir) => {
            portable::apply(&mut context, dir);
            portable::remove_old_exe();
            Some(data_location::DataLocation::fixed(
                dir.join(portable::DATA_DIR),
            ))
        }
        None => data_location::resolve(&mut context),
    };
    let is_portable = portable_dir.is_some();
    let mode = portable::Mode {
        portable: is_portable,
        replaceable: portable_dir.as_deref().is_some_and(portable::writable),
    };

    let result = tauri::Builder::default()
        // First, so a second launch only shows the running app and goes away.
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            background::show_main(app);
        }))
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(mode)
        .manage(update::Pending::default())
        .manage(icons::Icons::new().unwrap_or_else(|err| fatal(&err.to_string())))
        .register_asynchronous_uri_scheme_protocol(icons::SCHEME, icons::protocol)
        .setup(move |app| {
            let guard = logging::init(&app.path().app_log_dir()?)?;
            app.manage(guard);
            let data = app.path().app_local_data_dir()?;
            app.manage(
                location.unwrap_or_else(|| data_location::DataLocation::fixed(data.clone())),
            );
            app.manage(snapshots::Storage::open(data));
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
            background::tray(app.handle())?;
            background::on_notification_click(app.handle())?;
            #[cfg(feature = "capture")]
            app.manage(capture::service::AutoSync::spawn(
                app.handle(),
                window.hwnd().ok().map(|hwnd| hwnd.0 as isize),
            ));
            tracing::info!(
                version = %app.package_info().version,
                portable = is_portable,
                "started"
            );
            Ok(())
        })
        .on_window_event(background::on_window_event)
        .invoke_handler(tauri::generate_handler![
            background::notify,
            snapshots::import_snapshot,
            snapshots::keep_snapshot,
            snapshots::delete_snapshot,
            snapshots::delete_account,
            snapshots::list_snapshots,
            snapshots::snapshot_export,
            snapshots::session_timeline,
            data_location::data_dir,
            data_location::plan_data_dir,
            data_location::move_data_dir,
            snapshots::open_data_dir,
            snapshots::open_log_dir,
            snapshots::open_homepage,
            snapshots::open_group_chat,
            snapshots::open_video_search,
            snapshots::open_travelers_tales,
            planner::planner_data,
            planner::save_planner_data,
            tasks::tasks_data,
            tasks::save_tasks_data,
            update::app_info,
            update::check_update,
            update::download_update,
            update::install_update,
            #[cfg(feature = "capture")]
            capture::service::capture_status,
            #[cfg(feature = "capture")]
            capture::service::capture_changes,
            #[cfg(feature = "capture")]
            capture::service::capture_start,
            #[cfg(feature = "capture")]
            capture::service::capture_stop,
            #[cfg(feature = "capture")]
            capture::service::capture_save_now,
            #[cfg(feature = "capture")]
            capture::settings::sync_settings,
            #[cfg(feature = "capture")]
            capture::settings::set_sync_auto_start,
        ])
        .build(context);

    match result {
        // The event loop never returns on Windows.
        Ok(app) => app.run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                on_exit(app);
            }
        }),
        Err(err) => fatal(&err.to_string()),
    }
}

/// The app is exiting (not on a fatal error or an installer update, which
/// exit at once; the capture mode then sees its pipe close and exits too).
fn on_exit(app: &tauri::AppHandle) {
    #[cfg(feature = "capture")]
    if let Some(sync) = app.try_state::<capture::service::AutoSync>() {
        sync.shutdown();
    }
    #[cfg(not(feature = "capture"))]
    let _ = app;
}

/// Shows the error and exits. The release build has no console, so the
/// dialog is the only trace the user sees.
fn fatal(detail: &str) -> ! {
    win::error_box(text::APP_NAME, &format!("{}\n{detail}", text::FATAL_ERROR));
    std::process::exit(1)
}
