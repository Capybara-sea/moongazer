// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { syncOn, useCaptureStore } from "@/stores/captureStore"
import { text } from "@/text"

/** The pages' line before the first snapshot, by whether auto sync exists and is on. */
export function useEmptyBody() {
  const capture = useCaptureStore(s => s.capture)
  const on = useCaptureStore(syncOn)
  return text.overview.emptyBody(capture, on)
}
