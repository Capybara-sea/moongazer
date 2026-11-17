// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Running in the background: closing the window hides it to the tray, the
//! tray icon brings it back or quits, a second launch shows the running app,
//! and system notifications open the page they are about.

use serde::Serialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Window, WindowEvent};
use tauri_plugin_notification::NotificationExt;

use crate::text;

const OPEN: &str = "open";
const QUIT: &str = "quit";
/// What the page is told when the window was closed to the tray.
const HIDDEN_EVENT: &str = "hidden-to-tray";
/// What the page is told when a notification was clicked: the page to show.
const OPEN_PAGE_EVENT: &str = "open-page";

/// Shows, restores and focuses the main window.
pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        // Each step is worth trying when another fails.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// The tray icon: a left click shows the window; the menu opens it or quits.
pub fn tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, OPEN, text::TRAY_OPEN, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT, text::TRAY_QUIT, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &quit])?;
    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip(text::APP_NAME)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            OPEN => show_main(app),
            QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Closing the main window hides it instead: the app keeps reminding from the
/// tray until it is quit there.
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event
        && window.label() == "main"
    {
        api.prevent_close();
        if let Err(err) = window.hide() {
            tracing::warn!(%err, "could not hide the window");
        }
        if let Err(err) = window.emit(HIDDEN_EVENT, ()) {
            tracing::warn!(%err, "could not tell the page the window was hidden");
        }
    }
}

/// A click on a notification shows the window at the page it carries.
pub fn on_notification_click(app: &AppHandle) -> tauri::Result<()> {
    let handle = app.clone();
    app.notification()
        .on_action(move |action| {
            show_main(&handle);
            let page = action
                .notification()
                .and_then(|notification| notification.extra().get("page"))
                .and_then(|page| page.as_str());
            if let Some(page) = page
                && let Err(err) = handle.emit(OPEN_PAGE_EVENT, page)
            {
                tracing::warn!(%err, "could not open the notification's page");
            }
        })
        .map_err(|err| tauri::Error::Anyhow(err.into()))
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum NotifyError {
    Show(String),
}

/// Shows a system notification; a click on it opens `page`.
#[tauri::command]
pub fn notify(
    app: AppHandle,
    title: String,
    body: String,
    page: String,
) -> Result<(), NotifyError> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .extra("page", page)
        .show()
        .map_err(|err| NotifyError::Show(err.to_string()))
}
