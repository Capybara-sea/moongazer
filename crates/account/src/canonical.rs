// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! An order-independent hash of a JSON document.

use serde_json::Value;
use sha2::{Digest, Sha256};

pub fn hash(value: &Value) -> [u8; 32] {
    let mut bytes = Vec::new();
    write(value, &mut bytes);
    Sha256::digest(&bytes).into()
}

/// Writes JSON with object keys and array items in sorted order. Strings stay
/// escaped and every item ends in a comma, so different documents never
/// produce the same bytes.
fn write(value: &Value, out: &mut Vec<u8>) {
    match value {
        Value::Object(map) => {
            let mut entries: Vec<_> = map.iter().collect();
            entries.sort_unstable_by(|a, b| a.0.cmp(b.0));
            out.push(b'{');
            for (key, item) in entries {
                out.extend_from_slice(Value::from(key.as_str()).to_string().as_bytes());
                out.push(b':');
                write(item, out);
                out.push(b',');
            }
            out.push(b'}');
        }
        Value::Array(items) => {
            let mut parts: Vec<Vec<u8>> = items
                .iter()
                .map(|item| {
                    let mut part = Vec::new();
                    write(item, &mut part);
                    part
                })
                .collect();
            parts.sort_unstable();
            out.push(b'[');
            for part in parts {
                out.extend_from_slice(&part);
                out.push(b',');
            }
            out.push(b']');
        }
        scalar => out.extend_from_slice(scalar.to_string().as_bytes()),
    }
}
