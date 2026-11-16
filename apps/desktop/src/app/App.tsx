// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ToastProvider } from "@heroui/react"
import { LogoWarmUp } from "@/components/brand/AnimatedLogo"
import { AboutPage } from "@/features/about/AboutPage"
import { UpdateToasts } from "@/features/about/UpdateToasts"
import { HomePage } from "@/features/home/HomePage"
import { AppShell } from "./AppShell"

export function App() {
  return (
    <>
      <AppShell pages={{ home: <HomePage />, about: <AboutPage /> }} />
      <ToastProvider placement="bottom end" width={360} />
      <UpdateToasts />
      <LogoWarmUp />
    </>
  )
}
