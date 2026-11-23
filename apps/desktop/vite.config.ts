// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { createLogger, defineConfig } from "vite"

// A url() in CSS that a build cannot find is left as it is and fails only at run time, quietly:
// the UI font before `cargo xtask gen-data`, say. Builds fail on it instead.
const logger = createLogger()
const unresolved = (msg: string) => msg.includes("didn't resolve at build time")
for (const level of ["warn", "warnOnce"] as const) {
  const log = logger[level]
  logger[level] = (msg, options) => {
    if (unresolved(msg)) throw new Error(msg)
    log(msg, options)
  }
}

// Tauri opens the dev server on this fixed port and embeds dist/ in release builds.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  customLogger: logger,
  // A leading "/" resolves from this app's root, so "@logo" reaches the repository's assets/logo
  // ("@community" its assets/community, "@repo" its root for the changelog).
  resolve: {
    alias: {
      "@": "/src",
      "@logo": "/../../assets/logo",
      "@community": "/../../assets/community",
      "@repo": "/../..",
    },
  },
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: {
    target: "es2023",
    outDir: "dist",
    emptyOutDir: true,
    // The bundled npm packages and their license texts, at the root of dist/ so that the
    // About page can fetch it; `cargo xtask notices` reads it too.
    license: { fileName: "licenses.json" },
  },
})
