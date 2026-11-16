// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Joins class names; a later Tailwind class wins over an earlier conflicting one. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
