// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

use std::path::Path;

fn main() {
    // tauri-build embeds icons/icon.ico in the exe but only reruns when
    // tauri.conf.json or the capabilities change, so new icons from
    // `cargo xtask icons` would otherwise keep the old ones in local builds.
    println!("cargo:rerun-if-changed=icons");
    if std::env::var_os("CARGO_FEATURE_CAPTURE").is_some() {
        upstream_source();
        // The exe's own imports load from System32 only, not from the folder
        // it sits in: it also runs elevated, as auto sync's capture mode.
        // Dynamic loads are covered at run time (`win::capture`).
        println!("cargo:rustc-link-arg-bin=moongazer=/DEPENDENTLOADFLAG:0x800");
    }
    tauri_build::build();
}

/// Passes on which upstream source the capture module is linked against: the
/// `source` of teyvatme-core in Cargo.lock, tag and commit. A capture pack
/// built from any other is refused when it is loaded.
fn upstream_source() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("Cargo sets CARGO_MANIFEST_DIR");
    let lock = Path::new(&manifest_dir).join("../../../Cargo.lock");
    println!("cargo:rerun-if-changed={}", lock.display());
    let text = std::fs::read_to_string(&lock).expect("the workspace has a Cargo.lock");
    let source = text
        .split("[[package]]")
        .find(|package| package.contains("name = \"teyvatme-core\""))
        .and_then(|package| package.split("source = \"").nth(1))
        .and_then(|rest| rest.split('"').next())
        .expect("Cargo.lock names the source of teyvatme-core");
    println!("cargo:rustc-env=CAPTURE_UPSTREAM={source}");
}
