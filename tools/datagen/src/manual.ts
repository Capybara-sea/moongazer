// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import type { Character } from "./snap.ts"

// Snap.Metadata has neither the Traveler nor the Manekins. Exports do not say which twin the
// Traveler is, so the Travelers have no icon.
export const manualCharacters: Record<string, Character> = {
  TravelerAnemo: { name: "旅行者（风元素）", rarity: 5, element: "anemo", weapon: "sword" },
  TravelerGeo: { name: "旅行者（岩元素）", rarity: 5, element: "geo", weapon: "sword" },
  TravelerElectro: { name: "旅行者（雷元素）", rarity: 5, element: "electro", weapon: "sword" },
  TravelerDendro: { name: "旅行者（草元素）", rarity: 5, element: "dendro", weapon: "sword" },
  TravelerHydro: { name: "旅行者（水元素）", rarity: 5, element: "hydro", weapon: "sword" },
  TravelerPyro: { name: "旅行者（火元素）", rarity: 5, element: "pyro", weapon: "sword" },
  TravelerCryo: { name: "旅行者（冰元素）", rarity: 5, element: "cryo", weapon: "sword" },
  Manekin: { name: "奇偶·男性", rarity: 5, weapon: "sword", icon: "UI_AvatarIcon_MannequinBoy" },
  Manekina: { name: "奇偶·女性", rarity: 5, weapon: "sword", icon: "UI_AvatarIcon_MannequinGirl" },
}
