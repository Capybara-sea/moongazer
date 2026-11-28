// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Running in the background: closing the window hides it to the tray (or
//! quits, as set), the tray icon brings it back or quits, a second launch shows the running app,
//! and system notifications open the page they are about.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, PoisonError};

use serde::Serialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Window, WindowEvent};
use tauri_plugin_notification::NotificationExt;

use crate::text;

const OPEN: &str = "open";
const QUIT: &str = "quit";
const SYNC: &str = "sync";
/// What the page is told when the window was closed to the tray.
const HIDDEN_EVENT: &str = "hidden-to-tray";
/// What the page is told when a notification was clicked: the page to show.
const OPEN_PAGE_EVENT: &str = "open-page";
/// Closing the main window quits instead of hiding it; the page sets it.
static CLOSE_QUITS: AtomicBool = AtomicBool::new(false);

/// Shows, restores and focuses the main window.
pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        // Each step is worth trying when another fails.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Quits the app, hiding the window at once: stopping auto sync on the way
/// out can take seconds.
fn quit_app(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    app.exit(0);
}

/// The app's name in the tray's tooltip, marked in a test build.
fn tray_name(app: &AppHandle) -> String {
    let text = text::text();
    if crate::update::is_test_build(&app.config().identifier) {
        format!("{} {}", text.app_name, text.test_build)
    } else {
        text.app_name.to_owned()
    }
}

/// The tray icon: a left click shows the window; the menu opens it or quits.
pub fn tray(app: &AppHandle) -> tauri::Result<()> {
    let text = text::text();
    let open = MenuItem::with_id(app, OPEN, text.tray_open, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT, text.tray_quit, true, None::<&str>)?;
    let sync = MenuItem::with_id(app, SYNC, text.sync.off, false, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &sync,
            &PredefinedMenuItem::separator(app)?,
            &open,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip(tray_name(app))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            OPEN => show_main(app),
            QUIT => quit_app(app),
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
    app.manage(TrayItems {
        open,
        quit,
        sync,
        phase: Mutex::default(),
    });
    Ok(())
}

/// The tray menu's items, to rewrite in another language, and auto sync's
/// state the not clickable `sync` line shows.
struct TrayItems {
    open: MenuItem<tauri::Wry>,
    quit: MenuItem<tauri::Wry>,
    sync: MenuItem<tauri::Wry>,
    phase: Mutex<crate::capture::service::Phase>,
}

/// Shows auto sync's state in the tray menu and the tray icon's tooltip.
pub fn sync_status(app: &AppHandle, status: &crate::capture::service::Status) {
    if let Some(items) = app.try_state::<TrayItems>() {
        *items.phase.lock().unwrap_or_else(PoisonError::into_inner) = status.phase;
    }
    refresh_tray(app);
}

/// Writes the tray's menu and tooltip in the language in use. Queued for the
/// main thread rather than waited for: the supervisor calls this, and the main
/// thread may be waiting for the supervisor.
fn refresh_tray(app: &AppHandle) {
    let handle = app.clone();
    let queued = app.run_on_main_thread(move || {
        let Some(items) = handle.try_state::<TrayItems>() else {
            return;
        };
        let text = text::text();
        set_label(&items.open, text.tray_open);
        set_label(&items.quit, text.tray_quit);
        let tooltip = tray_name(&handle);
        let tooltip = sync_line(&items, &tooltip).unwrap_or(tooltip);
        if let Some(tray) = handle.tray_by_id("main")
            && let Err(err) = tray.set_tooltip(Some(tooltip))
        {
            tracing::warn!(%err, "could not update the tray tooltip");
        }
    });
    if let Err(err) = queued {
        tracing::warn!(%err, "could not update the tray");
    }
}

fn set_label(item: &MenuItem<tauri::Wry>, label: &str) {
    if let Err(err) = item.set_text(label) {
        tracing::warn!(%err, "could not update the tray menu");
    }
}

/// Writes auto sync's line; the tooltip with its state when that is worth one.
fn sync_line(items: &TrayItems, name: &str) -> Option<String> {
    use crate::capture::service::Phase;
    let text = &text::text().sync;
    let phase = *items.phase.lock().unwrap_or_else(PoisonError::into_inner);
    set_label(
        &items.sync,
        match phase {
            Phase::Off => text.off,
            Phase::Starting => text.starting,
            Phase::WaitingGame => text.waiting_game,
            Phase::WaitingLogin => text.waiting_login,
            Phase::Connected => text.connected,
            Phase::Interrupted => text.interrupted,
        },
    );
    match phase {
        Phase::Connected => Some(format!("{name} · {}", text.connected_short)),
        Phase::Interrupted => Some(format!("{name} · {}", text.interrupted_short)),
        _ => None,
    }
}

/// The page's language, for what the Rust side shows: the tray now, dialogs
/// later.
#[tauri::command]
pub fn set_language(app: AppHandle, english: bool) {
    if text::set_english(english) {
        refresh_tray(&app);
    }
}

/// The page's setting for what closing the main window does.
#[tauri::command]
pub fn set_close_quits(quits: bool) {
    CLOSE_QUITS.store(quits, Ordering::Relaxed);
}

/// Closing the main window hides it instead: the app keeps reminding from the
/// tray until it is quit there. Set to quit, it quits as the tray's Quit does.
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event
        && window.label() == "main"
    {
        api.prevent_close();
        if CLOSE_QUITS.load(Ordering::Relaxed) {
            quit_app(window.app_handle());
            return;
        }
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
