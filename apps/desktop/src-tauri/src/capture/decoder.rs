// SPDX-License-Identifier: MIT
// Copyright (c) 2026 tawan475
// Portions copyright (c) 2025 Erik Gilling and irminsul contributors
// See THIRD_PARTY_NOTICES.md.
// Changes copyright (c) 2026 Capybara_sea
// Modified from apps/desktop/src/replay.rs and apps/desktop/src/monitor.rs of
// https://github.com/tawan475/teyvat.me-capture at v1.17.28.

//! The decoder: Ethernet frames in, the account as a Leyline export out.

use anyhow::Result;
use teyvatme_core::decode::{self, DataReplacement, DataVerdict, SnifferEvent, SnifferStats};
use teyvatme_core::player_data::{ExportSettings, PlayerData};
use teyvatme_core::wish::hub::take_wish_events;
use teyvatme_protocol::{GamePacket, GameSniffer};
use tokio::sync::mpsc;

use super::pack::Pack;

/// What the export names as its source, in place of upstream's own name.
const SOURCE: &str = "Moongazer";

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
        }
    }

    /// Takes one Ethernet frame, seen at `at_ms` (unix milliseconds), and
    /// says whether it brought account data. Recovering the session key
    /// happens in here and can take seconds.
    pub fn feed(&mut self, frame: Vec<u8>, at_ms: u64) -> bool {
        decode::decode_one_packet(
            &mut self.sniffer,
            &mut self.generation,
            frame,
            &self.events_tx,
            &mut self.stats,
        );
        let mut applied = false;
        while let Ok(event) = self.events_rx.try_recv() {
            applied |= self.handle(event, at_ms);
        }
        applied
    }

    fn handle(&mut self, event: SnifferEvent, at_ms: u64) -> bool {
        let (commands, key) = match event {
            SnifferEvent::SessionReset => {
                self.replacement.connection_reset();
                return false;
            }
            SnifferEvent::Packet(GamePacket::Commands(commands), report) => {
                (commands, report.state)
            }
            SnifferEvent::Packet(..) => return false,
        };
        let mut classified = decode::classify_commands(&commands);
        // Wish history messages are not account data, and the wish key among
        // them is as good as a password: dropped unread.
        drop(take_wish_events(&mut classified));
        if classified.is_empty() {
            return false;
        }
        match self.replacement.verdict_for_batch(key, &mut classified) {
            DataVerdict::Apply => {}
            // A new login: its data replaces the account held so far.
            DataVerdict::ReplaceThenApply => self.player_data.reset(),
            DataVerdict::Hold => return false,
        }
        self.player_data.set_clock(at_ms / 1000);
        decode::apply_commands(&mut self.player_data, classified).any()
    }

    /// The account as a Leyline export saved at `now_ms`, or `None` until a
    /// login's characters and inventory are in.
    pub fn export(&self, now_ms: u64) -> Result<Option<String>> {
        if !self.player_data.holds_account() {
            return Ok(None);
        }
        let (mut good, report) = self
            .player_data
            .export_at(&ExportSettings::for_tracker(), now_ms);
        if !report.is_empty() {
            // Reasons and counts only. Entities the game data does not know
            // mean the pack is older than the game.
            tracing::warn!(left_out = %report.summary(), "the export left entities out");
        }
        good.source = SOURCE.to_owned();
        Ok(Some(serde_json::to_string(&good)?))
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use teyvatme_game_data::AnimeGameData;

    use super::*;

    #[test]
    fn a_frame_that_is_not_game_traffic_brings_nothing_to_export() {
        let mut decoder = Decoder::new(Pack {
            keys: HashMap::new(),
            game_data: AnimeGameData::new(),
            data_id: String::new(),
        });
        assert!(!decoder.feed(vec![0; 64], 0));
        assert!(decoder.export(0).unwrap().is_none());
    }
}
