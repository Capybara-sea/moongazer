// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

/**
 * localStorage for small UI preferences, keyed `moongazer:<module>:<key>`.
 * Storage can be unavailable; reads then give null and writes last only
 * until the app closes.
 */

export function readStored(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    // Unavailable: the caller's default applies.
    return null
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Unavailable: the choice lasts until the app closes.
  }
}
