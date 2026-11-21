// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Update checks. A new version is downloaded in the background and put in
//! place when the user restarts: by the NSIS installer for the installed
//! build, by swapping the executable for the portable one. A portable build
//! in a read-only folder only opens the download page.
//!
//! A build whose `plugins.updater.endpoints` is empty has updates off.

use std::ffi::OsString;
use std::process::Command;
use std::sync::{Mutex, MutexGuard, mpsc};

use anyhow::Context;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::portable;

/// The portable zip's entry in `latest.json`.
const PORTABLE_TARGET: &str = "windows-x86_64-portable";
const PROGRESS_EVENT: &str = "update-progress";

/// The update found by the last check and, once downloaded, its package:
/// the installer, or the portable zip.
#[derive(Default)]
pub struct Pending {
    update: Mutex<Option<Update>>,
    package: Mutex<Option<Vec<u8>>>,
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
    /// Whether an update is downloaded and put in place on restart, rather
    /// than only pointing to the download page.
    updates_in_place: bool,
    /// Whether this build has auto sync.
    capture: bool,
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
        portable: mode.portable,
        updates_enabled: updates_enabled(&app),
        updates_in_place: !mode.portable || mode.replaceable,
        capture: cfg!(feature = "capture"),
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
    if mode.portable {
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
    *lock(&pending.package) = None;
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

/// Downloads the pending update's package and keeps it in memory. The updater
/// checks its signature before returning it.
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
    let package = update
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
    *lock(&pending.package) = Some(package);
    tracing::info!("update downloaded");
    Ok(())
}

/// Installed build: runs the downloaded installer, which closes the app and
/// opens it again when done. Portable build: swaps in the new executable and
/// restarts, or, in a read-only folder, opens the download page.
#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    mode: State<'_, portable::Mode>,
    pending: State<'_, Pending>,
) -> Result<(), UpdateError> {
    if mode.portable && !mode.replaceable {
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

    // The capture mode runs this same exe, which the update replaces; it has
    // to be gone first. Checked before the package is taken, so a failure
    // keeps it for another try.
    #[cfg(feature = "capture")]
    let sync = tauri::Manager::try_state::<crate::capture::service::AutoSync>(&app);
    #[cfg(feature = "capture")]
    let sync_was_on = sync
        .as_ref()
        .is_some_and(|sync| sync.status().phase != crate::capture::service::Phase::Off);
    #[cfg(feature = "capture")]
    if let Some(sync) = &sync
        && !sync.shutdown()
    {
        if sync_was_on {
            sync.update_failed();
        }
        return Err(UpdateError::Install(
            "auto sync's capture mode did not exit".to_owned(),
        ));
    }
    let package = lock(&pending.package)
        .take()
        .ok_or(UpdateError::NothingPending)?;
    let update = lock(&pending.update)
        .clone()
        .ok_or(UpdateError::NothingPending)?;
    tracing::info!(version = %update.version, "installing update");
    let installed = if mode.portable {
        install_portable(&app, &package)
    } else {
        // On success this exits the app; the installer starts it again.
        update
            .install(&package)
            .map_err(|err| UpdateError::Install(err.to_string()))
    };
    if installed.is_err() {
        // Kept, so the user can try again without downloading it again.
        *lock(&pending.package) = Some(package);
        #[cfg(feature = "capture")]
        if sync_was_on && let Some(sync) = &sync {
            sync.update_failed();
        }
    }
    installed
}

/// Swaps in the new executable and starts it; this one then exits.
fn install_portable(app: &AppHandle, package: &[u8]) -> Result<(), UpdateError> {
    let failed = |err: anyhow::Error| UpdateError::Install(format!("{err:#}"));
    let exe = std::env::current_exe()
        .context("finding the program")
        .map_err(failed)?;
    portable::replace_exe(&exe, package).map_err(failed)?;
    // The new program is in place, so this one exits even if starting it
    // fails; it then starts the next time the user opens the app, and staying
    // open would only offer an update that can no longer be applied.
    if let Err(err) = relaunch(app, &[]) {
        tracing::error!(error = %err, "starting the new version failed");
        app.exit(0);
    }
    Ok(())
}

/// Starts the program again with `args` and exits this one; stays when the
/// new one cannot be started.
pub fn relaunch(app: &AppHandle, args: &[OsString]) -> std::io::Result<()> {
    let exe = std::env::current_exe()?;
    // Released first, or the new program finds this one's single-instance
    // lock, hands over its arguments and exits. The lock is a mutex and a
    // window that only the main thread, which made them, can release, and
    // commands run elsewhere.
    let (released, wait) = mpsc::channel();
    let handle = app.clone();
    let queued = app.run_on_main_thread(move || {
        tauri_plugin_single_instance::destroy(&handle);
        let _ = released.send(());
    });
    if queued.is_err() || wait.recv().is_err() {
        tracing::warn!("the single-instance lock was not released");
    }
    Command::new(&exe).args(args).spawn()?;
    app.exit(0);
    Ok(())
}
