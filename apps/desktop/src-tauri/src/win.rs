// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

//! The app's Windows FFI: native dialogs that work without the webview, and
//! (`capture`) what auto sync needs from Windows.

#[cfg(feature = "capture")]
pub mod capture;

use windows_sys::Win32::UI::WindowsAndMessaging::{
    IDYES, MB_ICONERROR, MB_ICONWARNING, MB_OK, MB_YESNO, MESSAGEBOX_STYLE, MessageBoxW,
};

pub fn error_box(title: &str, message: &str) {
    message_box(title, message, MB_OK | MB_ICONERROR);
}

/// A yes/no question; true when the user picks yes.
pub fn ask(title: &str, message: &str) -> bool {
    message_box(title, message, MB_YESNO | MB_ICONWARNING) == IDYES
}

fn message_box(title: &str, message: &str, style: MESSAGEBOX_STYLE) -> i32 {
    let title = wide(title);
    let message = wide(message);
    // SAFETY: both pointers are NUL-terminated UTF-16 buffers that outlive the
    // call, and a null owner window is allowed.
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            message.as_ptr(),
            title.as_ptr(),
            style,
        )
    }
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}
