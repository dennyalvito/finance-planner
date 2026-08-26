import { createFileRoute } from "@tanstack/react-router"

import { ProfilePage } from "@/features/finance/coin-app"

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
})
