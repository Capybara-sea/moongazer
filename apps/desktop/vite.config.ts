// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Tauri opens the dev server on this fixed port and embeds dist/ in release builds.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // A leading "/" resolves from this app's root, so "@logo" reaches the repository's assets/logo.
  resolve: { alias: { "@": "/src", "@logo": "/../../assets/logo" } },
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { target: "es2023", outDir: "dist", emptyOutDir: true },
})
