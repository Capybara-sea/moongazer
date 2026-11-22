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

/** Whether anything is stored under the app's keys yet, as after an earlier run. */
export function anyStored() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith("moongazer:")) return true
    }
    return false
  } catch {
    // Unavailable: as on a first run.
    return false
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Unavailable: the choice lasts until the app closes.
  }
}
