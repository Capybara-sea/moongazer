// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ToastProvider } from "@heroui/react"
import { LogoWarmUp } from "@/components/brand/AnimatedLogo"
import { AboutPage } from "@/features/about/AboutPage"
import { UpdateToasts } from "@/features/about/UpdateToasts"
import { ArtifactsPage } from "@/features/artifacts/ArtifactsPage"
import { CharactersPage } from "@/features/characters/CharactersPage"
import { HomePage } from "@/features/home/HomePage"
import { MaterialsPage } from "@/features/materials/MaterialsPage"
import { OverviewPage } from "@/features/overview/OverviewPage"
import { SettingsPage } from "@/features/settings/SettingsPage"
import { WeaponsPage } from "@/features/weapons/WeaponsPage"
import { AppShell } from "./AppShell"

export function App() {
  return (
    <>
      <AppShell
        pages={{
          home: <HomePage />,
          overview: <OverviewPage />,
          characters: <CharactersPage />,
          weapons: <WeaponsPage />,
          artifacts: <ArtifactsPage />,
          materials: <MaterialsPage />,
          settings: <SettingsPage />,
          about: <AboutPage />,
        }}
      />
      <ToastProvider placement="bottom end" width={360} />
      <UpdateToasts />
      <LogoWarmUp />
    </>
  )
}
