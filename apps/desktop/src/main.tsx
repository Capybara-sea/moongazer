// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "@/app/App"
import { setLanguage, setWindowTitle } from "@/lib/backend"
import { useCaptureStore } from "@/stores/captureStore"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { useUpdateStore } from "@/stores/updateStore"
import { lang, text } from "@/text"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("index.html has no #root element")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The webview's own menu (back, reload, save as, print) has no place in the app; text fields keep
// theirs for cut, copy and paste.
document.addEventListener("contextmenu", event => {
  const { target } = event
  const field = target instanceof Element && target.closest("input, textarea, [contenteditable]")
  if (!field) event.preventDefault()
})

document.documentElement.lang = lang === "en" ? "en" : "zh-CN"
// tauri.conf.json keeps ASCII names; the window shows the name in the UI's language.
document.title = text.appName
void setWindowTitle(text.appName)
setLanguage(lang === "en").catch(() => {
  // Outside the app window there is no Rust side to tell.
})
void useUpdateStore.getState().load()
void useSnapshotStore.getState().load()
void useCaptureStore.getState().load()
