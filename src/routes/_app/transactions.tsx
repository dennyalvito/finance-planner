import { createFileRoute } from "@tanstack/react-router"

import { TransactionsPage } from "@/features/finance/coin-app"

export const Route = createFileRoute("/_app/transactions")({
  component: TransactionsPage,
})
