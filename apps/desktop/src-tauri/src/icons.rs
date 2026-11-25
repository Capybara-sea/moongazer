// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The `icon` protocol: the page loads game icons by name from
//! `http://icon.localhost/<name>`. Each one is downloaded once, from Enka or
//! Project Amber, into `cache/icons` in the app's local data directory, which
//! the portable build keeps in `app-data`.

use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use anyhow::{Result, bail};
use reqwest::Client;
use tauri::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use tauri::http::{HeaderValue, Request, Response, StatusCode};
use tauri::{AppHandle, Manager, Runtime, UriSchemeContext, UriSchemeResponder};

pub const SCHEME: &str = "icon";
const USER_AGENT: &str = concat!("moongazer/", env!("CARGO_PKG_VERSION"));
const TIMEOUT: Duration = Duration::from_secs(30);
const MAX_BYTES: usize = 4 << 20;
const PNG_SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";

pub struct Icons {
    client: Client,
    /// Names every host answered 404 for; asked again after a restart.
    missing: Mutex<HashSet<String>>,
}

impl Icons {
    pub fn new() -> reqwest::Result<Self> {
        // reqwest is built without a crypto provider; the updater installs
        // this same one before its requests, and the first install wins.
        let _ = rustls::crypto::ring::default_provider().install_default();
        let client = Client::builder()
            .user_agent(USER_AGENT)
            .timeout(TIMEOUT)
            .build()?;
        Ok(Self {
            client,
            missing: Mutex::default(),
        })
    }

    fn missing(&self) -> MutexGuard<'_, HashSet<String>> {
        self.missing.lock().unwrap_or_else(|e| e.into_inner())
    }
}

pub fn protocol<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let app = ctx.app_handle().clone();
    let name = icon_name(request.uri().path()).to_owned();
    tauri::async_runtime::spawn(async move {
        responder.respond(serve(&app, &name).await);
    });
}

fn icon_name(path: &str) -> &str {
    path.split('/').nth(1).unwrap_or_default()
}

async fn serve<R: Runtime>(app: &AppHandle<R>, name: &str) -> Response<Vec<u8>> {
    if !valid_name(name) {
        return status(StatusCode::BAD_REQUEST);
    }
    let Ok(dir) = app.path().app_local_data_dir() else {
        return status(StatusCode::INTERNAL_SERVER_ERROR);
    };
    let dir = dir.join("cache").join("icons");
    if let Ok(bytes) = fs::read(dir.join(format!("{name}.png"))) {
        return png(bytes);
    }
    let icons = app.state::<Icons>();
    if icons.missing().contains(name) {
        return status(StatusCode::NOT_FOUND);
    }
    match download(&icons.client, &dir, name).await {
        Download::Found(bytes) => png(bytes),
        Download::Missing => {
            icons.missing().insert(name.to_owned());
            status(StatusCode::NOT_FOUND)
        }
        Download::Failed => status(StatusCode::BAD_GATEWAY),
    }
}

fn valid_name(name: &str) -> bool {
    (1..=128).contains(&name.len()) && name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

fn png(bytes: Vec<u8>) -> Response<Vec<u8>> {
    let mut response = Response::new(bytes);
    let headers = response.headers_mut();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("image/png"));
    headers.insert(
        CACHE_CONTROL,
        HeaderValue::from_static("max-age=31536000, immutable"),
    );
    response
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = code;
    response
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Host {
    Enka,
    /// Project Amber.
    Yatta,
}

impl Host {
    fn label(self) -> &'static str {
        match self {
            Self::Enka => "enka",
            Self::Yatta => "yatta",
        }
    }

    fn url(self, name: &str) -> String {
        match self {
            Self::Enka => format!("https://enka.network/ui/{name}.png"),
            Self::Yatta => {
                let dir = if name.starts_with("UI_RelicIcon_") {
                    "reliquary/"
                } else if name.starts_with("UI_NameCard") {
                    "namecard/"
                } else if name.starts_with("UI_AchievementIcon_") {
                    "achievement/"
                } else if name.starts_with("UI_Homeworld_") {
                    "furniture/"
                } else if name.starts_with("UI_Home_Suite_") {
                    "furnitureSuite/"
                } else {
                    ""
                };
                format!("https://gi.yatta.moe/assets/UI/{dir}{name}.png")
            }
        }
    }
}

/// Item, element, profile frame and achievement goal icons try Project Amber
/// first: Enka is missing some of them, the Cryo icon among them and 33 of the
/// 75 goal icons. So does name card art, which Enka has only at half size.
/// Enka has no furnishing or furnishing set icons.
fn hosts(name: &str) -> [Host; 2] {
    const AMBER_FIRST: [&str; 7] = [
        "UI_ItemIcon_",
        "UI_Buff_Element_",
        "UI_AvatarFrameIcon_",
        "UI_NameCardPic_",
        "UI_AchievementIcon_",
        "UI_Homeworld_",
        "UI_Home_Suite_",
    ];
    if AMBER_FIRST.iter().any(|prefix| name.starts_with(prefix)) {
        [Host::Yatta, Host::Enka]
    } else {
        [Host::Enka, Host::Yatta]
    }
}

enum Download {
    Found(Vec<u8>),
    /// Every host answered 404.
    Missing,
    Failed,
}

/// Tries each host in turn and caches the first icon found in `dir`.
async fn download(client: &Client, dir: &Path, name: &str) -> Download {
    let mut missing = true;
    for host in hosts(name) {
        let started = Instant::now();
        match fetch(client, &host.url(name)).await {
            Ok(Some(bytes)) => {
                tracing::info!(
                    host = host.label(),
                    bytes = bytes.len(),
                    ms = started.elapsed().as_millis(),
                    "icon downloaded"
                );
                if let Err(err) = store(dir, name, &bytes) {
                    tracing::warn!(error = %err, "caching an icon failed");
                }
                return Download::Found(bytes);
            }
            Ok(None) => {}
            Err(err) => {
                missing = false;
                tracing::warn!(
                    host = host.label(),
                    ms = started.elapsed().as_millis(),
                    error = %format!("{err:#}"),
                    "icon download failed"
                );
            }
        }
    }
    if missing {
        tracing::info!("icon missing on every host");
        Download::Missing
    } else {
        Download::Failed
    }
}

/// The PNG at `url`, or `None` on 404. Errors leave out the URL, which names
/// the icon.
async fn fetch(client: &Client, url: &str) -> Result<Option<Vec<u8>>> {
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(reqwest::Error::without_url)?;
    match response.status() {
        StatusCode::OK => {}
        StatusCode::NOT_FOUND => return Ok(None),
        status => bail!("status {status}"),
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(reqwest::Error::without_url)?
    {
        if bytes.len() + chunk.len() > MAX_BYTES {
            bail!("more than {MAX_BYTES} bytes");
        }
        bytes.extend_from_slice(&chunk);
    }
    if !is_png(&bytes) {
        bail!("not a PNG");
    }
    Ok(Some(bytes))
}

fn is_png(bytes: &[u8]) -> bool {
    bytes.starts_with(PNG_SIGNATURE)
}

/// Writes through a file of its own, then renames it into place, so two
/// requests for the same icon, even from two running apps, never mix their
/// writes.
fn store(dir: &Path, name: &str, bytes: &[u8]) -> io::Result<()> {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    fs::create_dir_all(dir)?;
    let n = NEXT.fetch_add(1, Ordering::Relaxed);
    let temp = dir.join(format!("{name}.{}.{n}.tmp", std::process::id()));
    let result =
        fs::write(&temp, bytes).and_then(|()| fs::rename(&temp, dir.join(format!("{name}.png"))));
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_ascii_letters_digits_and_underscores() {
        assert!(valid_name("UI_AvatarIcon_Shougun"));
        assert!(valid_name(&"a".repeat(128)));
        let long = "a".repeat(129);
        for name in [
            "",
            "UI_Icon.png",
            "..",
            "UI%20Icon",
            "UI-Icon",
            "UI_\u{00e9}",
            &long,
        ] {
            assert!(!valid_name(name), "{name}");
        }
    }

    #[test]
    fn only_the_first_path_segment_names_the_icon() {
        assert_eq!(
            icon_name("/UI_Gacha_AvatarIcon_Shougun"),
            "UI_Gacha_AvatarIcon_Shougun"
        );
        assert_eq!(icon_name("/UI_Icon/more"), "UI_Icon");
        assert_eq!(icon_name("/"), "");
        assert_eq!(icon_name(""), "");
    }

    #[test]
    fn item_element_frame_and_name_card_icons_try_project_amber_first() {
        assert_eq!(hosts("UI_Buff_Element_Ice"), [Host::Yatta, Host::Enka]);
        assert_eq!(hosts("UI_ItemIcon_202"), [Host::Yatta, Host::Enka]);
        assert_eq!(hosts("UI_AvatarFrameIcon_001"), [Host::Yatta, Host::Enka]);
        assert_eq!(hosts("UI_NameCardPic_Bp1_P"), [Host::Yatta, Host::Enka]);
        assert_eq!(hosts("UI_AchievementIcon_A016"), [Host::Yatta, Host::Enka]);
        assert_eq!(hosts("UI_Home_Suite_Camp_01"), [Host::Yatta, Host::Enka]);
        assert_eq!(hosts("UI_AvatarIcon_Shougun"), [Host::Enka, Host::Yatta]);
        assert_eq!(hosts("UI_RelicIcon_15031_4"), [Host::Enka, Host::Yatta]);
    }

    #[test]
    fn urls_follow_each_hosts_layout() {
        assert_eq!(
            Host::Yatta.url("UI_Homeworld_Exterior_Common_Plant_Tree_01_Lod0"),
            "https://gi.yatta.moe/assets/UI/furniture/UI_Homeworld_Exterior_Common_Plant_Tree_01_Lod0.png"
        );
        assert_eq!(
            Host::Yatta.url("UI_Home_Suite_Camp_01"),
            "https://gi.yatta.moe/assets/UI/furnitureSuite/UI_Home_Suite_Camp_01.png"
        );
        assert_eq!(
            Host::Enka.url("UI_RelicIcon_15031_4"),
            "https://enka.network/ui/UI_RelicIcon_15031_4.png"
        );
        assert_eq!(
            Host::Yatta.url("UI_RelicIcon_15031_4"),
            "https://gi.yatta.moe/assets/UI/reliquary/UI_RelicIcon_15031_4.png"
        );
        assert_eq!(
            Host::Yatta.url("UI_NameCardPic_Bp1_P"),
            "https://gi.yatta.moe/assets/UI/namecard/UI_NameCardPic_Bp1_P.png"
        );
        assert_eq!(
            Host::Yatta.url("UI_Buff_Element_Ice"),
            "https://gi.yatta.moe/assets/UI/UI_Buff_Element_Ice.png"
        );
        assert_eq!(
            Host::Yatta.url("UI_AchievementIcon_A001"),
            "https://gi.yatta.moe/assets/UI/achievement/UI_AchievementIcon_A001.png"
        );
    }

    #[test]
    fn only_bodies_with_the_png_signature_are_icons() {
        assert!(is_png(b"\x89PNG\r\n\x1a\nrest"));
        assert!(!is_png(b"<!DOCTYPE html>"));
        assert!(!is_png(b"\x89PNG"));
        assert!(!is_png(b""));
    }

    #[test]
    #[ignore = "downloads from Enka and Project Amber"]
    fn icons_are_downloaded_into_the_cache() {
        let dir = std::env::temp_dir().join(format!("moongazer-icons-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let icons = Icons::new().unwrap();
        for name in ["UI_Buff_Element_Ice", "UI_AvatarIcon_Shougun"] {
            let downloaded = tauri::async_runtime::block_on(download(&icons.client, &dir, name));
            let Download::Found(bytes) = downloaded else {
                panic!("{name} was not downloaded");
            };
            let cached = fs::read(dir.join(format!("{name}.png"))).unwrap();
            assert!(cached == bytes, "{name} was cached differently");
        }
        let leftovers = fs::read_dir(&dir).unwrap().count();
        assert_eq!(leftovers, 2);
        fs::remove_dir_all(dir).unwrap();
    }
}
