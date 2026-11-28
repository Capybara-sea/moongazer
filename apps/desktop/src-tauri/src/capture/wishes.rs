// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Reading the wish history while auto sync runs, when the user turned it on
//! (off by default). Opening the game's wish history hands the game a key,
//! with which the app reads the history from the game's own API: each banner
//! from the newest record back to the first one already stored.
//!
//! The key is kept in memory only: never logged, never written, and sent
//! nowhere but the game's API. Upstream's hub tells the wish key from the
//! game's other keys, builds the link and says when to read (its
//! `Schedule`); the reading runs on a thread of its own.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use serde::Serialize;
use storage::Wish;
use tauri::{AppHandle, Emitter, Manager};
use teyvatme_core::wish::Banner;
use teyvatme_core::wish::api::{
    ApiRecord, FetchError, HttpError, HttpGet, HttpReply, LogClient, Pacing, Sleeper,
};
use teyvatme_core::wish::hub::{HubReceivers, Trigger, WishEvent, WishHub};
use teyvatme_core::wish::link::{PAGE_SIZE, WishKey};
use teyvatme_core::wish::sync::Schedule;

use crate::snapshots::Storage;
use crate::wishes::{parse_time, timezone};

/// How a read goes, after each page.
pub const PROGRESS_EVENT: &str = "wishes-progress";
/// A read ended.
pub const READ_EVENT: &str = "wishes-read";

/// More pages than any banner has: six months of wishes are a few hundred.
const MAX_PAGES: u32 = 2_000;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

pub struct Reader {
    hub: WishHub,
    receivers: HubReceivers,
    schedule: Schedule,
    on: bool,
    /// A read is running on its thread.
    busy: Arc<AtomicBool>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    uid: u32,
    /// The banners being read, in order, with the new records found so far
    /// and whether each is done.
    banners: Vec<BannerProgress>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BannerProgress {
    banner: Banner,
    added: usize,
    done: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadEnd {
    uid: u32,
    /// New records by banner, for the banners finished.
    added: Vec<(Banner, usize)>,
    /// Why the read stopped early: `expired`, `busy`, `failed`,
    /// `otherAccount` or `stopped`.
    error: Option<&'static str>,
}

impl Reader {
    pub fn new(on: bool) -> Self {
        let (hub, receivers) = WishHub::new(Arc::new(|| {}));
        Self {
            hub,
            receivers,
            schedule: Schedule::default(),
            on,
            busy: Arc::default(),
        }
    }

    pub fn set_on(&mut self, on: bool) {
        self.on = on;
        if !on {
            self.hub.new_login();
        }
    }

    pub fn forward(&mut self, events: Vec<WishEvent>, uid: Option<u32>) {
        if self.on {
            self.hub.forward(events, uid);
        }
    }

    /// A new login, or sync stopped: the key goes, and a read under way stops.
    pub fn new_login(&self) {
        self.hub.new_login();
    }

    /// Takes the hub's triggers and starts a read when one is due.
    pub fn tick(&mut self, app: &AppHandle) {
        let now = Instant::now();
        while let Ok(trigger) = self.receivers.trigger_rx.try_recv() {
            match trigger {
                Trigger::NewKey => self.schedule.on_new_key(now),
                Trigger::Wish(banner) => self.schedule.on_wish(now, banner),
                Trigger::Cleared => self.schedule.clear(),
            }
        }
        if !self.on
            || self.busy.load(Ordering::Acquire)
            || !self.schedule.next_due().is_some_and(|due| due <= now)
        {
            return;
        }
        let banners = self.schedule.take_due(now);
        let key = self.receivers.key_rx.borrow().clone();
        let Some(key) = key.filter(|key| key.is_fresh(now)) else {
            return;
        };
        let Some(uid) = key.uid() else {
            return;
        };
        self.busy.store(true, Ordering::Release);
        let busy = self.busy.clone();
        let app = app.clone();
        let login = self.receivers.login_rx.clone();
        let key_tx = self.hub.key_sender();
        let spawned = std::thread::Builder::new()
            .name("moongazer-wishes".to_owned())
            .spawn(move || {
                let started = *login.borrow();
                let stopped = || *login.borrow() != started;
                let end = tauri::async_runtime::block_on(read(&app, key, uid, &banners, stopped));
                if end.error == Some("expired") {
                    key_tx.send_replace(None);
                }
                if end.error.is_none() {
                    let at = crate::wishes::now_ms().to_string();
                    let key = crate::wishes::read_at_key(u64::from(uid));
                    let _ = app.state::<Storage>().set_setting(&key, &at);
                }
                let _ = app.emit(READ_EVENT, end);
                busy.store(false, Ordering::Release);
            });
        if spawned.is_err() {
            self.busy.store(false, Ordering::Release);
        }
    }
}

/// Reads `banners` of `uid`, storing each banner's new records once it is
/// read to the first one already stored.
async fn read(
    app: &AppHandle,
    key: WishKey,
    uid: u32,
    banners: &[Banner],
    stopped: impl Fn() -> bool,
) -> ReadEnd {
    let mut progress = Progress {
        uid,
        banners: banners
            .iter()
            .map(|&banner| BannerProgress {
                banner,
                added: 0,
                done: false,
            })
            .collect(),
    };
    let mut end = ReadEnd {
        uid,
        added: Vec::new(),
        error: None,
    };
    let Ok(http) = Http::new() else {
        end.error = Some("failed");
        return end;
    };
    let endpoint = key.endpoint().to_owned();
    let mut log = LogClient::new(http, endpoint, key, ThreadSleep, Pacing::default());
    let _ = app.emit(PROGRESS_EVENT, &progress);
    for (index, &banner) in banners.iter().enumerate() {
        log.next_banner();
        match read_banner(app, &mut log, uid, banner, &stopped, |added| {
            progress.banners[index].added = added;
            let _ = app.emit(PROGRESS_EVENT, &progress);
        })
        .await
        {
            Ok(added) => {
                tracing::info!(banner, added, "wish history: banner read");
                progress.banners[index].done = true;
                let _ = app.emit(PROGRESS_EVENT, &progress);
                end.added.push((banner, added));
            }
            Err(error) => {
                tracing::info!(banner, error, "wish history: reading stopped");
                end.error = Some(error);
                return end;
            }
        }
    }
    end
}

async fn read_banner(
    app: &AppHandle,
    log: &mut LogClient<Http, ThreadSleep>,
    uid: u32,
    banner: Banner,
    stopped: impl Fn() -> bool,
    mut on_page: impl FnMut(usize),
) -> Result<usize, &'static str> {
    let storage = app.state::<Storage>();
    let zone = timezone(u64::from(uid));
    let uid_text = uid.to_string();
    let mut new = Vec::new();
    let mut end_id = 0;
    for page in 1..=MAX_PAGES {
        if stopped() {
            return Err("stopped");
        }
        let read = log
            .page(banner, page, end_id)
            .await
            .map_err(|error| match error {
                FetchError::KeyExpired => "expired",
                FetchError::Throttled => "busy",
                FetchError::Failed(_) | FetchError::Refused { .. } => "failed",
            })?;
        let full = read.records.len() >= PAGE_SIZE as usize;
        if read.records.iter().any(|record| record.uid != uid_text) {
            return Err("otherAccount");
        }
        let wishes: Vec<Wish> = read
            .records
            .iter()
            .map(|record| wish(record, zone))
            .collect::<Option<_>>()
            .ok_or("failed")?;
        let known = storage
            .with_db(|db| {
                wishes
                    .iter()
                    .map(|wish| db.has_wish(u64::from(uid), wish.id))
                    .collect::<anyhow::Result<Vec<bool>>>()
            })
            .map_err(|_| "failed")?;
        let met = known.iter().any(|&known| known);
        for (wish, known) in wishes.into_iter().zip(known) {
            end_id = wish.id;
            if !known {
                new.push(wish);
            }
        }
        on_page(new.len());
        if met || !full {
            break;
        }
    }
    if stopped() {
        return Err("stopped");
    }
    storage
        .with_db(|db| db.add_wishes(u64::from(uid), &new))
        .map_err(|_| "failed")
}

/// A record as stored; `None` for one that cannot be read.
fn wish(record: &ApiRecord, timezone: i64) -> Option<Wish> {
    Some(Wish {
        id: record.id.parse().ok()?,
        gacha_type: record.gacha_type.parse().ok()?,
        item_id: record.item_id.parse().unwrap_or(0),
        name: record.name.clone(),
        item_type: record.item_type.clone(),
        rank: record.rank_type.parse().ok()?,
        time: parse_time(&record.time, timezone)?,
    })
}

/// The API's client: reqwest, as the updater and the icons use it.
struct Http(reqwest::Client);

impl Http {
    fn new() -> reqwest::Result<Self> {
        // reqwest is built without a crypto provider; the updater installs
        // ring, and whichever runs first does it.
        let _ = rustls::crypto::ring::default_provider().install_default();
        Ok(Self(
            reqwest::Client::builder()
                .timeout(REQUEST_TIMEOUT)
                .build()?,
        ))
    }
}

impl HttpGet for Http {
    fn get(&self, url: &reqwest::Url) -> impl Future<Output = Result<HttpReply, HttpError>> + Send {
        let request = self.0.get(url.clone());
        async move {
            // Errors without their URL: it carries the key.
            let response = request
                .send()
                .await
                .map_err(|err| HttpError::Unreachable(err.without_url().to_string()))?;
            let status = response.status();
            let body = response
                .bytes()
                .await
                .map_err(|err| HttpError::CutOff(err.without_url().to_string()))?;
            Ok(HttpReply {
                status: status.as_u16(),
                status_text: status.to_string(),
                body: body.to_vec(),
            })
        }
    }
}

/// The read has a thread of its own, so its waits just sleep.
struct ThreadSleep;

impl Sleeper for ThreadSleep {
    async fn sleep(&self, duration: Duration) {
        std::thread::sleep(duration);
    }
}
