// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "@/app/App"
import { setWindowTitle } from "@/lib/backend"
import { useSnapshotStore } from "@/stores/snapshotStore"
import { useUpdateStore } from "@/stores/updateStore"
import { text } from "@/text/zh"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("index.html has no #root element")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// tauri.conf.json keeps ASCII names; the window shows the Chinese name.
document.title = text.appName
void setWindowTitle(text.appName)
void useUpdateStore.getState().load()
void useSnapshotStore.getState().load()
