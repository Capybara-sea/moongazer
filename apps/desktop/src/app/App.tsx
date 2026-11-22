// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Capybara_sea

import { ToastProvider } from "@heroui/react"
import { LogoWarmUp } from "@/components/brand/AnimatedLogo"
import { AboutPage } from "@/features/about/AboutPage"
import { UpdateToasts } from "@/features/about/UpdateToasts"
import { ArtifactsPage } from "@/features/artifacts/ArtifactsPage"
import { CharactersPage } from "@/features/characters/CharactersPage"
import { CollectionPage } from "@/features/collection/CollectionPage"
import { HomePage } from "@/features/home/HomePage"
import { MaterialsPage } from "@/features/materials/MaterialsPage"
import { BackgroundEvents } from "@/features/messages/BackgroundEvents"
import { OverviewPage } from "@/features/overview/OverviewPage"
import { PlannerPage } from "@/features/planner/PlannerPage"
import { SettingsPage } from "@/features/settings/SettingsPage"
import { SyncEvents } from "@/features/sync/SyncEvents"
import { WeaponsPage } from "@/features/weapons/WeaponsPage"
import { AppShell } from "./AppShell"
import { RestartDialog } from "./RestartDialog"

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
          collection: <CollectionPage />,
          planner: <PlannerPage />,
          settings: <SettingsPage />,
          about: <AboutPage />,
        }}
      />
      <ToastProvider placement="bottom end" width={360} />
      <UpdateToasts />
      <RestartDialog />
      {/* Reminders (features/messages/ReminderTimer) stay off until they are confirmed. */}
      <BackgroundEvents />
      <SyncEvents />
      <LogoWarmUp />
    </>
  )
}
