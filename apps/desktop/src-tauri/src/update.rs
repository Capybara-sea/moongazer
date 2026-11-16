// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Update checks. The installed build downloads a new version in the
//! background and installs it through the NSIS installer when the user
//! restarts; the portable build only checks and opens the download page.
//!
//! Updates stay off while `plugins.updater.endpoints` is empty, which is the
//! case until the repository is public.

use std::sync::{Mutex, MutexGuard};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::portable;

/// The portable zip's entry in `latest.json`.
const PORTABLE_TARGET: &str = "windows-x86_64-portable";
const PROGRESS_EVENT: &str = "update-progress";

/// The update found by the last check and, once downloaded, its installer.
#[derive(Default)]
pub struct Pending {
    update: Mutex<Option<Update>>,
    installer: Mutex<Option<Vec<u8>>>,
}

/// A poisoned lock still holds a usable value: nothing here is left half done.
fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    version: String,
    portable: bool,
    updates_enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
    notes: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum UpdateError {
    Check(String),
    Download(String),
    Install(String),
    NothingPending,
}

#[tauri::command]
pub fn app_info(app: AppHandle, mode: State<'_, portable::Mode>) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
        portable: mode.0,
        updates_enabled: updates_enabled(&app),
    }
}

fn updates_enabled(app: &AppHandle) -> bool {
    app.config()
        .plugins
        .0
        .get("updater")
        .and_then(|config| config.get("endpoints"))
        .and_then(|endpoints| endpoints.as_array())
        .is_some_and(|endpoints| !endpoints.is_empty())
}

#[tauri::command]
pub async fn check_update(
    app: AppHandle,
    mode: State<'_, portable::Mode>,
    pending: State<'_, Pending>,
) -> Result<Option<UpdateInfo>, UpdateError> {
    let mut builder = app.updater_builder();
    if mode.0 {
        builder = builder.target(PORTABLE_TARGET);
    }
    let updater = builder
        .build()
        .map_err(|err| UpdateError::Check(err.to_string()))?;
    let update = updater
        .check()
        .await
        .map_err(|err| UpdateError::Check(err.to_string()))?;
    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        notes: u.body.clone(),
    });
    *lock(&pending.update) = update;
    *lock(&pending.installer) = None;
    tracing::info!(available = info.is_some(), "update check finished");
    Ok(info)
}

/// `page` is our own field in latest.json; without it, the zip itself.
fn download_page(update: &Update) -> String {
    update
        .raw_json
        .get("page")
        .and_then(|page| page.as_str())
        .map_or_else(|| update.download_url.to_string(), str::to_owned)
}

/// Downloads the installer of the pending update and keeps it in memory; the
/// installed build only.
#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    pending: State<'_, Pending>,
) -> Result<(), UpdateError> {
    let update = lock(&pending.update)
        .clone()
        .ok_or(UpdateError::NothingPending)?;
    tracing::info!(version = %update.version, "downloading update");
    let mut downloaded = 0u64;
    let installer = update
        .download(
            move |chunk, total| {
                downloaded += chunk as u64;
                // Progress is cosmetic; a dropped event only freezes the bar.
                let _ = app.emit(PROGRESS_EVENT, Progress { downloaded, total });
            },
            || {},
        )
        .await
        .map_err(|err| UpdateError::Download(err.to_string()))?;
    *lock(&pending.installer) = Some(installer);
    tracing::info!("update downloaded");
    Ok(())
}

/// Installed build: runs the downloaded installer, which closes the app and
/// opens it again when done. Portable build: opens the download page.
#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    mode: State<'_, portable::Mode>,
    pending: State<'_, Pending>,
) -> Result<(), UpdateError> {
    if mode.0 {
        // Opening the page keeps the update pending, so the button works again.
        let page = {
            let guard = lock(&pending.update);
            let update = guard.as_ref().ok_or(UpdateError::NothingPending)?;
            download_page(update)
        };
        // latest.json itself is not signed, so it gets no say over the scheme.
        if !page.starts_with("https://") {
            return Err(UpdateError::Install(format!(
                "the download page is not https: {page}"
            )));
        }
        tracing::info!("opening the download page");
        return app
            .opener()
            .open_url(page, None::<&str>)
            .map_err(|err| UpdateError::Install(err.to_string()));
    }

    let installer = lock(&pending.installer)
        .take()
        .ok_or(UpdateError::NothingPending)?;
    let update = lock(&pending.update)
        .clone()
        .ok_or(UpdateError::NothingPending)?;
    tracing::info!(version = %update.version, "installing update");
    // On success this exits the app; the installer starts it again.
    if let Err(err) = update.install(&installer) {
        // Kept, so the user can try again without downloading it again.
        *lock(&pending.installer) = Some(installer);
        return Err(UpdateError::Install(err.to_string()));
    }
    Ok(())
}
