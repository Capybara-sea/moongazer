// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Element } from "@/domain/elements"

/** A tinted background and border in the element's color, for avatars and selected filters. */
export const ELEMENT_TINT: Record<Element, string> = {
  pyro: "border-(--el-pyro-line) bg-(--el-pyro-bg)",
  hydro: "border-(--el-hydro-line) bg-(--el-hydro-bg)",
  anemo: "border-(--el-anemo-line) bg-(--el-anemo-bg)",
  electro: "border-(--el-electro-line) bg-(--el-electro-bg)",
  dendro: "border-(--el-dendro-line) bg-(--el-dendro-bg)",
  cryo: "border-(--el-cryo-line) bg-(--el-cryo-bg)",
  geo: "border-(--el-geo-line) bg-(--el-geo-bg)",
}

/** Text in the element's color. */
export const ELEMENT_TEXT: Record<Element, string> = {
  pyro: "text-(--el-pyro)",
  hydro: "text-(--el-hydro)",
  anemo: "text-(--el-anemo)",
  electro: "text-(--el-electro)",
  dendro: "text-(--el-dendro)",
  cryo: "text-(--el-cryo)",
  geo: "text-(--el-geo)",
}
