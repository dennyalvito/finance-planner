import { createFileRoute } from "@tanstack/react-router"

import { OverviewPage } from "@/features/finance/coin-app"

export const Route = createFileRoute("/_app/")({
  component: OverviewPage,
})
