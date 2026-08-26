import { createFileRoute } from "@tanstack/react-router"

import { PreferencesPage } from "@/features/finance/coin-app"

export const Route = createFileRoute("/_app/preferences")({
  component: PreferencesPage,
})
