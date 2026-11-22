// SPDX-License-Identifier: MIT
// Copyright (c) 2026 tawan475
// Portions copyright (c) 2025 Erik Gilling and irminsul contributors
// See THIRD_PARTY_NOTICES.md.
// Changes copyright (c) 2026 Capybara_sea
// Modified from apps/desktop/src/replay.rs and apps/desktop/src/monitor.rs of
// https://github.com/tawan475/teyvat.me-capture at v1.17.28.

//! The decoder: Ethernet frames in, the account as a Leyline export out.

use std::collections::HashMap;

use anyhow::Result;
use teyvatme_core::decode::{
    self, DataReplacement, DataVerdict, KeyReport, SnifferEvent, SnifferStats,
};
use teyvatme_core::delta::Keyed;
use teyvatme_core::player_data::{LoginParts, PlayerData};
use teyvatme_core::wish::hub::{WishEvent, take_wish_events};
use teyvatme_protocol::{CommandMatch, ConnectionPacket, GamePacket, GameSniffer, KeyState};
use tokio::sync::mpsc;

use super::anecdotes::Book;
use super::commissions;
use super::pack::Pack;

/// What the export names as its source, in place of upstream's own name.
const SOURCE: &str = "Moongazer";

/// The game's UDP ports, which tell a frame's direction.
const GAME_PORTS: [u16; 2] = [22101, 22102];

pub struct Decoder {
    sniffer: GameSniffer,
    generation: u64,
    stats: SnifferStats,
    // teyvatme-core hands its events over on a tokio channel; both ends are
    // used from the one thread, so no runtime is involved.
    events_tx: mpsc::UnboundedSender<SnifferEvent>,
    events_rx: mpsc::UnboundedReceiver<SnifferEvent>,
    replacement: DataReplacement,
    player_data: PlayerData,
    /// The login's Travel Accounts book, kept up to date while playing.
    book: Option<Book>,
    commission_cities: HashMap<u32, u32>,
    progress: commissions::Progress,
}

/// What one frame did.
#[derive(Debug, Default)]
pub struct Fed {
    /// Account data was applied.
    pub data: bool,
    /// Commands were applied to the account: `data`, or only sections it
    /// does not count (exploration, events, the wardrobe).
    pub applied: bool,
    /// A new login's data replaced the account held so far.
    pub new_login: bool,
    /// A new connection began: the sniffer started over, or a handshake went
    /// by (unauthenticated, so only a hint that a login is under way).
    pub connection: bool,
    /// The sniffer started over: the connection the account was read from
    /// ended. Its data stays held until a new login's replaces it.
    pub reset: bool,
    /// The client said its version, which names the server: `CNREL…` is the
    /// Chinese client.
    pub chinese_client: Option<bool>,
    /// Commands decrypted with the session key went by: the game is being
    /// read, account data or not.
    pub session_traffic: bool,
    /// The login's key was given up on while the capture delivered only this
    /// PC's sends: only the compatible capture can read such a PC.
    pub one_way: bool,
}

/// An export, with what the export left out and its keyed form (for telling
/// what changed between two).
pub struct Exported {
    pub json: String,
    /// Reasons and counts (`unknown_weapon: 2`) when entities the game data
    /// does not know were left out: the capture pack is older than the game.
    pub left_out: Option<String>,
    pub keyed: Keyed,
    pub account: Account,
}

/// Who the export is of, for the connection panel.
#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub nickname: Option<String>,
    pub uid: Option<u32>,
    pub adventure_rank: Option<u32>,
}

impl Decoder {
    pub fn new(pack: Pack) -> Self {
        let sniffer = GameSniffer::new().set_initial_keys(pack.keys);
        let (events_tx, events_rx) = mpsc::unbounded_channel();
        Self {
            generation: sniffer.session_generation(),
            sniffer,
            stats: SnifferStats::default(),
            events_tx,
            events_rx,
            replacement: DataReplacement::default(),
            player_data: PlayerData::new(pack.game_data).with_game_data_sha(Some(&pack.data_id)),
            book: None,
            commission_cities: pack.commission_cities,
            progress: commissions::Progress::new(pack.commission_rewards),
        }
    }

    /// When the game started (unix milliseconds), if this capture saw it
    /// start. It bounds the search for a later login's key; a time later
    /// than the real start would hide the first login from it.
    pub fn set_game_started(&mut self, started_ms: Option<u64>) {
        self.sniffer.set_game_started_ms(started_ms);
    }

    /// Takes one Ethernet frame, seen at `at_ms` (unix milliseconds).
    /// Recovering the session key happens in here and can take seconds.
    pub fn feed(&mut self, frame: Vec<u8>, at_ms: u64) -> Fed {
        self.stats
            .note_frame(0, decode::frame_direction(&frame, GAME_PORTS));
        decode::decode_one_packet(
            &mut self.sniffer,
            &mut self.generation,
            frame,
            &self.events_tx,
            &mut self.stats,
        );
        let mut fed = Fed::default();
        while let Ok(event) = self.events_rx.try_recv() {
            self.handle(event, at_ms, &mut fed);
        }
        fed.one_way = self.stats.one_way_login(self.sniffer.key_recovery_failed());
        fed
    }

    fn handle(&mut self, event: SnifferEvent, at_ms: u64, fed: &mut Fed) {
        let (commands, key) = match event {
            SnifferEvent::SessionReset => {
                self.replacement.connection_reset();
                fed.connection = true;
                fed.reset = true;
                return;
            }
            SnifferEvent::Packet(GamePacket::Commands(commands), report) => {
                (commands, report.state)
            }
            SnifferEvent::Packet(GamePacket::Connection(connection), _) => {
                if matches!(
                    connection,
                    ConnectionPacket::HandshakeRequested | ConnectionPacket::HandshakeEstablished
                ) {
                    fed.connection = true;
                }
                return;
            }
        };
        if key == KeyState::Session && !commands.is_empty() {
            fed.session_traffic = true;
        }
        let mut classified = decode::classify_commands(&commands);
        commissions::fill_in(&mut classified, &commands, &self.commission_cities);
        // Wish history messages are not account data, and the wish key among
        // them is as good as a password: dropped unread. Only the client's
        // version is looked at, for which server this is.
        for event in take_wish_events(&mut classified) {
            if let WishEvent::ClientVersion(version) = event {
                fed.chinese_client = Some(version.starts_with("CN"));
            }
        }
        // Commands upstream recognised; `Flat` is what it did not.
        let read: Vec<u16> = classified
            .iter()
            .filter(|(_, found)| !matches!(found, CommandMatch::Flat(_)))
            .map(|(id, _)| *id)
            .collect();
        if !classified.is_empty() {
            match self.replacement.verdict_for_batch(key, &mut classified) {
                DataVerdict::Apply => {}
                // A new login: its data replaces the account held so far.
                DataVerdict::ReplaceThenApply => {
                    self.player_data.reset();
                    self.book = None;
                    self.progress.new_login();
                    fed.new_login = true;
                }
                DataVerdict::Hold => return,
            }
            for (id, found) in &classified {
                if let CommandMatch::Anecdotes(data) = found
                    && let Some(command) = commands.iter().find(|c| !c.sent && c.command_id == *id)
                {
                    self.book = Some(Book::new(data.clone(), &command.proto_data));
                }
            }
            let player = &self.player_data;
            self.progress.teach(&mut classified, at_ms, || {
                player.gi_player().and_then(|player| player.ar)
            });
            self.player_data.set_clock(at_ms / 1000);
            fed.applied = true;
            fed.data |= decode::apply_commands(&mut self.player_data, classified).any();
        }
        // The book's notifies are nothing upstream reads (see anecdotes.rs).
        if key == KeyState::Session
            && let Some(book) = &mut self.book
        {
            let mut changed = false;
            for command in commands
                .iter()
                .filter(|c| !c.sent && !read.contains(&c.command_id))
            {
                changed |= book.update(&command.proto_data);
            }
            if changed {
                self.player_data.set_clock(at_ms / 1000);
                self.player_data.process_anecdotes(book.data());
                fed.applied = true;
                fed.data = true;
            }
        }
    }

    pub fn key(&self) -> KeyReport {
        KeyReport::of(&self.sniffer)
    }

    /// Frames from the server since the sniffer last started over.
    pub fn received_since_reset(&self) -> u64 {
        self.stats.frames_since_reset().1
    }

    /// Which parts of a login's data are held.
    pub fn login_parts(&self) -> LoginParts {
        self.player_data.login_parts()
    }

    /// The account as a Leyline export saved at `now_ms`, or `None` until a
    /// login's characters and inventory are in.
    pub fn export(&self, now_ms: u64) -> Result<Option<Exported>> {
        if !self.player_data.holds_account() {
            return Ok(None);
        }
        let (mut good, report, keyed) = self.player_data.live_export(now_ms);
        let left_out = (!report.is_empty()).then(|| report.summary());
        if let Some(left_out) = &left_out {
            // Reasons and counts only. Entities the game data does not know
            // mean the pack is older than the game.
            tracing::warn!(left_out = %left_out, "the export left entities out");
        }
        good.source = SOURCE.to_owned();
        // What a tracker upload leaves out (upstream 1.18): a saved export is
        // not an upload, and upstream's own exports leave it off too.
        good.gi_off = None;
        let account = good
            .gi_player
            .as_ref()
            .map(|player| Account {
                nickname: player.nickname.clone(),
                uid: player.uid,
                adventure_rank: player.ar,
            })
            .unwrap_or_default();
        Ok(Some(Exported {
            json: serde_json::to_string(&good)?,
            left_out,
            keyed,
            account,
        }))
    }
}

#[cfg(test)]
mod tests {
    use teyvatme_game_data::AnimeGameData;

    use super::*;

    #[test]
    fn a_frame_that_is_not_game_traffic_brings_nothing_to_export() {
        let mut decoder = Decoder::new(Pack {
            keys: HashMap::new(),
            game_data: AnimeGameData::new(),
            data_id: String::new(),
            commission_cities: HashMap::new(),
            commission_rewards: Vec::new(),
        });
        let fed = decoder.feed(vec![0; 64], 0);
        assert!(!fed.data && !fed.connection && !fed.one_way);
        assert!(decoder.export(0).unwrap().is_none());
    }
}
