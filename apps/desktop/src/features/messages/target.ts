// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { isPageKey, navigate } from "@/lib/route"
import { useAccountStore } from "@/stores/accountStore"
import { useCaptureStore } from "@/stores/captureStore"

/**
 * Opens what a message or notification is about: a page, or the auto sync
 * panel; for a reminder of another account still saved, on that account.
 */
export function openTarget(target: string, account?: number) {
  const store = useAccountStore.getState()
  if (account !== undefined && account !== store.group?.token) {
    if (store.accounts.some(group => group.token === account)) store.selectAccount(account)
  }
  if (target === "sync") useCaptureStore.getState().setPanelOpen(true)
  else if (isPageKey(target)) navigate(target)
}
