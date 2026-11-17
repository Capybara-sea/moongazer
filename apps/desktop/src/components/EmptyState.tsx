// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { ReactNode } from "react"

/** A dashed box saying a list has nothing to show. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[14px] border border-border border-dashed px-4 py-10 text-center text-[13px] text-muted">
      {children}
    </p>
  )
}
