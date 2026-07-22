import { createFileRoute } from "@tanstack/react-router"

import { CoinApp } from "@/features/finance/coin-app"

export const Route = createFileRoute("/")({
  component: () => <CoinApp view="overview" />,
})
