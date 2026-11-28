// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { en } from "./en"
import { lang } from "./lang"
import { zh } from "./zh"

export { LANG_KEY, LANG_NAMES, type Lang, lang } from "./lang"

/** The shape both languages share: zh's, with its strings widened. */
export type Text = Widen<typeof zh>

// Mapping an array or tuple keeps its length.
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T

/** Every user-facing string of the web UI, in the language of this page load. */
export const text: Text = lang === "en" ? en : zh
