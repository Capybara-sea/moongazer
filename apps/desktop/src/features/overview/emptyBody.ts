// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { syncOn, useCaptureStore } from "@/stores/captureStore"
import { text } from "@/text"

/** The pages' line before the first snapshot, by whether auto sync is on. */
export function useEmptyBody() {
  return text.overview.emptyBody(useCaptureStore(syncOn))
}
