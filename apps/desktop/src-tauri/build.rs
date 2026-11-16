// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

fn main() {
    // tauri-build embeds icons/icon.ico in the exe but only reruns when
    // tauri.conf.json or the capabilities change, so new icons from
    // `cargo xtask icons` would otherwise keep the old ones in local builds.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build();
}
