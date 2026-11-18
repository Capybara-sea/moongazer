// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! Challenge records the game sends only when their screen is opened: the
//! Stygian Onslaught records and the Spiral Abyss record book. A new login
//! has none until then, so the account's last ones are carried into its
//! exports. The page shows the record of the period running, so one carried
//! past the end of its period reads as not started.

use serde_json::{Map, Value};

/// The carried records, under `gi_endgame`.
const CARRIED: [&str; 2] = ["stygian", "abyss"];

pub type Carry = Map<String, Value>;

/// The carried records `export` holds itself.
pub fn held(export: &Value) -> Carry {
    let mut held = Carry::new();
    if let Some(endgame) = export.get("gi_endgame").and_then(Value::as_object) {
        for key in CARRIED {
            if let Some(record) = endgame.get(key) {
                held.insert(key.to_owned(), record.clone());
            }
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

/// Puts the records `export` lacks in from `carry`; true when it did.
pub fn fill(export: &mut Value, carry: &Carry) -> bool {
    let present = held(export);
    let missing: Vec<_> = carry
        .iter()
        .filter(|(key, _)| !present.contains_key(*key))
        .collect();
    if missing.is_empty() {
        return false;
    }
    let Some(endgame) = export.as_object_mut().map(|root| {
        root.entry("gi_endgame")
            .or_insert_with(|| Value::Object(Map::new()))
    }) else {
        return false;
    };
    let Some(endgame) = endgame.as_object_mut() else {
        return false;
    };
    for (key, record) in missing {
        endgame.insert(key.clone(), record.clone());
    }
    true
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
        assert!(gather(
            &mut carry,
            &json!({ "gi_endgame": { "stygian": { "records": [0] }, "abyss": { "periods": [2] } } })
        ));
        // The newer record stays: gathering goes from the newest export back.
        assert_eq!(carry["stygian"], json!({ "records": [1] }));

        let mut fresh = json!({ "gi_endgame": { "abyss": { "periods": [3] }, "theater": {} } });
        assert!(fill(&mut fresh, &carry));
        assert_eq!(
            fresh,
            json!({ "gi_endgame": {
                "abyss": { "periods": [3] },
                "theater": {},
                "stygian": { "records": [1] },
            } })
        );
        assert!(!fill(&mut fresh, &carry));

        let mut bare = json!({ "format": "GOOD" });
        assert!(fill(&mut bare, &carry));
        assert_eq!(bare["gi_endgame"]["abyss"], json!({ "periods": [2] }));
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
