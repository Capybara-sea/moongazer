// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import builds from "@/generated/builds.json"
import planner from "@/generated/planner.json"
import { lang } from "@/text"

/**
 * The generated game data in the UI's language. Each file with text has an
 * English twin under generated/en/ with the same entries, ids and numbers;
 * only the text differs, and only the language in use is loaded. Builds and
 * the planner's costs have no text.
 */

export { builds, planner }

const en = lang === "en"

export const names: typeof import("@/generated/names.json") = (
  en ? await import("@/generated/en/names.json") : await import("@/generated/names.json")
).default

export const overview: typeof import("@/generated/overview.json") = (
  en ? await import("@/generated/en/overview.json") : await import("@/generated/overview.json")
).default

export const collection: typeof import("@/generated/collection.json") = (
  en ? await import("@/generated/en/collection.json") : await import("@/generated/collection.json")
).default

export const activities: typeof import("@/generated/activities.json") = (
  en ? await import("@/generated/en/activities.json") : await import("@/generated/activities.json")
).default
