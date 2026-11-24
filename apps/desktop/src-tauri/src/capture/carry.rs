// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! What the game sends only when its screen is opened: the Stygian Onslaught
//! records, the Spiral Abyss record book and Paimon's Bargains. A new login
//! has none until then, so the account's last ones are carried into its
//! exports. The pages count a record or the shop's buys for the period
//! running, so one carried past the end of its period reads as not started.

use serde_json::{Map, Value};

/// The carried parts, by key, and the export section each sits in.
const CARRIED: [(&str, &str); 3] = [
    ("stygian", "gi_endgame"),
    ("abyss", "gi_endgame"),
    ("bargains", "gi_tasks"),
];

pub type Carry = Map<String, Value>;

/// The carried parts `export` holds itself.
pub fn held(export: &Value) -> Carry {
    let mut held = Carry::new();
    for (key, section) in CARRIED {
        if let Some(part) = export.get(section).and_then(|section| section.get(key)) {
            held.insert(key.to_owned(), part.clone());
        }
    }
    held
}

/// Adds what `from` holds and `carry` lacks; true once `carry` has them all.
pub fn gather(carry: &mut Carry, from: &Value) -> bool {
    for (key, record) in held(from) {
        carry.entry(key).or_insert(record);
    }
    carry.len() == CARRIED.len()
}

/// Puts the parts `export` lacks in from `carry`; true when it did.
pub fn fill(export: &mut Value, carry: &Carry) -> bool {
    let present = held(export);
    let mut filled = false;
    for (key, section) in CARRIED {
        let Some(part) = carry.get(key).filter(|_| !present.contains_key(key)) else {
            continue;
        };
        let Some(section) = export.as_object_mut().map(|root| {
            root.entry(section)
                .or_insert_with(|| Value::Object(Map::new()))
        }) else {
            return filled;
        };
        let Some(section) = section.as_object_mut() else {
            continue;
        };
        section.insert(key.to_owned(), part.clone());
        filled = true;
    }
    filled
}

/// `json` with the records it lacks put in from `carry`; as it was when it
/// lacks none or does not parse.
pub fn fill_text(json: String, carry: &Carry) -> String {
    if carry.is_empty() {
        return json;
    }
    let Ok(mut export) = serde_json::from_str::<Value>(&json) else {
        return json;
    };
    if !fill(&mut export, carry) {
        return json;
    }
    serde_json::to_string(&export).unwrap_or(json)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn records_an_export_lacks_are_put_in_and_its_own_kept() {
        let mut carry = Carry::new();
        assert!(!gather(
            &mut carry,
            &json!({ "gi_endgame": { "stygian": { "records": [1] }, "theater": {} } })
        ));
        assert!(!gather(
            &mut carry,
            &json!({ "gi_endgame": { "stygian": { "records": [0] }, "abyss": { "periods": [2] } } })
        ));
        // Gathered once every part is in.
        assert!(gather(
            &mut carry,
            &json!({ "gi_tasks": { "bargains": { "at": 0, "fates": [] } } })
        ));
        // The newer record stays: gathering goes from the newest export back.
        assert_eq!(carry["stygian"], json!({ "records": [1] }));

        let mut fresh = json!({ "gi_endgame": { "abyss": { "periods": [3] }, "theater": {} } });
        assert!(fill(&mut fresh, &carry));
        assert_eq!(
            fresh,
            json!({
                "gi_endgame": {
                    "abyss": { "periods": [3] },
                    "theater": {},
                    "stygian": { "records": [1] },
                },
                "gi_tasks": { "bargains": { "at": 0, "fates": [] } },
            })
        );
        assert!(!fill(&mut fresh, &carry));

        let mut bare = json!({ "format": "GOOD" });
        assert!(fill(&mut bare, &carry));
        assert_eq!(bare["gi_endgame"]["abyss"], json!({ "periods": [2] }));
    }

    #[test]
    fn the_shop_is_carried_into_the_tasks() {
        let mut carry = Carry::new();
        gather(
            &mut carry,
            &json!({ "gi_tasks": { "bargains": { "at": 1, "fates": [] }, "resin": {} } }),
        );
        let mut fresh = json!({ "gi_tasks": { "resin": { "value": 3 } } });
        assert!(fill(&mut fresh, &carry));
        assert_eq!(
            fresh,
            json!({ "gi_tasks": { "resin": { "value": 3 }, "bargains": { "at": 1, "fates": [] } } })
        );
        let mut newer = json!({ "gi_tasks": { "bargains": { "at": 2, "fates": [] } } });
        assert!(!fill(&mut newer, &carry));
        assert_eq!(newer["gi_tasks"]["bargains"]["at"], json!(2));
    }

    #[test]
    fn text_stays_as_it_was_without_anything_to_put_in() {
        let carry = held(&json!({ "gi_endgame": { "stygian": { "records": [] } } }));
        let full = r#"{"gi_endgame":{"stygian":{"records":[5]}}}"#.to_owned();
        assert_eq!(fill_text(full.clone(), &carry), full);
        assert_eq!(fill_text("not json".to_owned(), &carry), "not json");
        let filled = fill_text(r#"{"gi_endgame":{}}"#.to_owned(), &carry);
        assert_eq!(
            serde_json::from_str::<Value>(&filled).unwrap(),
            json!({ "gi_endgame": { "stygian": { "records": [] } } })
        );
    }
}
