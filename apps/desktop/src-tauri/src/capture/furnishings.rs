// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The furnishings in the bag. Upstream holds them with the rest of the
//! inventory but does not export them; the furnishing sets page tells from
//! them what a set still lacks.

use std::collections::{BTreeMap, HashMap};

use teyvatme_protocol::CommandMatch;
use teyvatme_protocol::r#gen::protos::Item;

/// The bag's furnishings by guid: furnishing id and count.
#[derive(Default)]
pub struct Furnishings(HashMap<u64, (u32, u32)>);

impl Furnishings {
    pub fn new_login(&mut self) {
        self.0.clear();
    }

    /// Follows the item messages of a batch, as upstream does its inventory.
    /// Changed and deleted items are candidates that other messages share a
    /// shape with: deleting what is not held does nothing, and `counts` keeps
    /// only the account's own.
    pub fn note(&mut self, classified: &[(u16, CommandMatch)]) {
        for (_, found) in classified {
            match found {
                CommandMatch::Items(items) | CommandMatch::ChangedItems(items) => self.add(items),
                CommandMatch::DeletedItems(guids) => {
                    for guid in guids {
                        self.0.remove(guid);
                    }
                }
                _ => {}
            }
        }
    }

    fn add(&mut self, items: &[Item]) {
        for item in items.iter().filter(|item| item.has_furniture()) {
            match item.furniture().count {
                0 => self.0.remove(&item.guid),
                count => self.0.insert(item.guid, (item.item_id, count)),
            };
        }
    }

    /// The counts by furnishing id of the account `uid`'s (a guid's top half
    /// is its account's UID); `None` when it holds none.
    pub fn counts(&self, uid: u32) -> Option<BTreeMap<u32, u32>> {
        let mut counts = BTreeMap::new();
        for (guid, (id, count)) in &self.0 {
            if guid >> 32 == u64::from(uid) {
                *counts.entry(*id).or_insert(0) += count;
            }
        }
        (!counts.is_empty()).then_some(counts)
    }
}

#[cfg(test)]
mod tests {
    use teyvatme_protocol::r#gen::protos::{Furniture, Material};

    use super::*;

    const UID: u32 = 100_000_001;

    fn furnishing(id: u32, counter: u64, count: u32) -> Item {
        let mut item = Item::new();
        item.item_id = id;
        item.guid = u64::from(UID) << 32 | counter;
        let mut furniture = Furniture::new();
        furniture.count = count;
        item.set_furniture(furniture);
        item
    }

    #[test]
    fn counts_add_up_the_stacks_of_one_furnishing() {
        let mut bag = Furnishings::default();
        let mut wood = Item::new();
        wood.item_id = 101301;
        wood.guid = u64::from(UID) << 32 | 9;
        wood.set_material(Material::new());
        let items = vec![
            furnishing(370503, 1, 2),
            furnishing(370503, 2, 3),
            furnishing(372301, 3, 1),
            wood,
        ];
        bag.note(&[(1, CommandMatch::Items(items))]);
        let counts = bag.counts(UID).unwrap();
        assert_eq!(counts, BTreeMap::from([(370503, 5), (372301, 1)]));
    }

    #[test]
    fn changes_and_deletions_follow_the_bag() {
        let mut bag = Furnishings::default();
        bag.note(&[(1, CommandMatch::Items(vec![furnishing(370503, 1, 2)]))]);
        bag.note(&[(
            2,
            CommandMatch::ChangedItems(vec![furnishing(370503, 1, 4)]),
        )]);
        assert_eq!(bag.counts(UID), Some(BTreeMap::from([(370503, 4)])));
        bag.note(&[(
            3,
            CommandMatch::DeletedItems(vec![u64::from(UID) << 32 | 1]),
        )]);
        assert_eq!(bag.counts(UID), None);
    }

    #[test]
    fn another_accounts_furnishings_are_left_out() {
        let mut bag = Furnishings::default();
        let mut stray = furnishing(370503, 1, 2);
        stray.guid = 7 << 32 | 1;
        bag.note(&[(
            1,
            CommandMatch::Items(vec![stray, furnishing(372301, 2, 1)]),
        )]);
        assert_eq!(bag.counts(UID), Some(BTreeMap::from([(372301, 1)])));
        bag.new_login();
        assert_eq!(bag.counts(UID), None);
    }
}
