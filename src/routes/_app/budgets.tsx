import { createFileRoute } from "@tanstack/react-router"

import { BudgetsPage } from "@/features/finance/coin-app"

export const Route = createFileRoute("/_app/budgets")({
  component: BudgetsPage,
})
